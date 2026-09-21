import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, timer } from 'rxjs';
import { catchError, debounce, map, switchMap, tap, timeout } from 'rxjs/operators';
import {
  FIELD_BASE_CLASSES,
  FIELD_FONT_SIZES,
  FIELD_HEIGHT_CLASSES,
  FIELD_PADDING_CLASSES,
  fieldBorderColor,
  fieldSurfaceClasses,
  type FieldSize,
  type FieldState,
} from '../field/field.types';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { Icon } from '../icon/icon';
import {
  LISTBOX_PANEL_CLASSES,
  LISTBOX_SELECTED_WEIGHT,
  listboxOptionClasses,
  moveActiveIndex,
} from '../listbox/listbox.types';
import { createConnectedOverlay, PANEL_POSITIONS } from '../overlay/connected-overlay';
import { ScanDetector } from '../keyboard/scan-detector';
import { readMilliseconds } from '../tokens/read-token';
import {
  DELAY_SEARCH_INPUT_TOKEN,
  EWMS_SEARCH_SELECT_MESSAGES,
  SCAN_THRESHOLD_TOKEN,
  SEARCH_MORE_CLASSES,
  SEARCH_NOTE_CLASSES,
  TIMEOUT_SEARCH_TOKEN,
  type SearchSelectMessages,
  type SearchStatus,
} from './search-select.types';
import type { SearchDisplay, SearchSource } from './search-source';

export type { SearchDisplay, SearchPage, SearchSource } from './search-source';
export type { SearchSelectMessages, SearchStatus } from './search-select.types';

let nextSearchSelectId = 0;

interface SearchRequest {
  readonly query: string;
  readonly page: number;
  readonly append: boolean;
  /** Vino de una ráfaga de escáner: resuelve sin abrir el panel si puede. */
  readonly scan: boolean;
}

/**
 * Campo que filtra contra una fuente mientras se tipea; el valor es el registro, no el texto.
 * Es el caso opuesto a `ewms-select` (decenas de miles de SKU). Ver vault: Search-Select.
 */
@Component({
  selector: 'ewms-search-select',
  templateUrl: './search-select.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [provideValueAccessor(() => SearchSelect)],
})
export class SearchSelect<T> extends FormControlBase<T | null> implements OnDestroy {
  /** Una interfaz, no un endpoint: pasar a un backend real cambia solo el `SearchSource`. */
  readonly source = input.required<SearchSource<T>>();

  readonly display = input.required<SearchDisplay<T>>();

  /** Siembra el control; después manda `writeValue`. */
  readonly value = input<T | null>(null);

  readonly size = input<FieldSize>('md');

  readonly label = input.required<string>();

  readonly placeholder = input<string>('');

  readonly hint = input<string>('');

  /** Solo visual: valida el formulario de arriba. */
  readonly error = input<boolean>(false);

  /** Pisa, en esta instancia, los textos de `EWMS_SEARCH_SELECT_MESSAGES` (ADR 0008). */
  readonly messages = input<Partial<SearchSelectMessages> | null>(null);

  private readonly providedMessages = inject(EWMS_SEARCH_SELECT_MESSAGES);

  /**
   * Se llama `words` y no `text` porque `text` es lo tipeado: dos nombres casi
   * iguales con sentido opuesto ya hicieron que la caja dijera «Buscando…».
   */
  protected readonly words = computed<SearchSelectMessages>(() => ({
    ...this.providedMessages,
    ...(this.messages() ?? {}),
  }));

  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef: OverlayRef | null = null;

  private readonly id = ++nextSearchSelectId;
  protected readonly fieldId = `ewms-search-select-${this.id}`;
  protected readonly labelId = `${this.fieldId}-label`;
  protected readonly listboxId = `${this.fieldId}-listbox`;
  protected readonly hintId = `${this.fieldId}-hint`;
  protected readonly statusId = `${this.fieldId}-status`;
  protected readonly errorId = `${this.fieldId}-error`;

  protected readonly valueSource = this.value;

  protected readonly text = signal('');
  protected readonly items = signal<readonly T[]>([]);
  protected readonly status = signal<SearchStatus>('idle');
  protected readonly hasMore = signal(false);
  protected readonly total = signal<number | null>(null);
  protected readonly isOpen = signal(false);
  protected readonly activeIndex = signal(-1);

  /** Para el mensaje «sin resultados para X». */
  protected readonly searchedText = signal('');

  /** RFE-04: el reintento repite esta petición tal cual. */
  private lastRequest: SearchRequest | null = null;

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly panelClasses = LISTBOX_PANEL_CLASSES;
  protected readonly noteClasses = SEARCH_NOTE_CLASSES;
  protected readonly moreClasses = SEARCH_MORE_CLASSES;
  protected readonly selectedWeight = LISTBOX_SELECTED_WEIGHT;

  private readonly typed = new Subject<string>();
  /** Después de la espera, o directo desde un escaneo. */
  private readonly requests = new Subject<SearchRequest>();

  /**
   * El detector compartido, no una copia: dos respuestas a «¿es una pistola?» derivan.
   * Una instancia por campo, porque cada campo es una ráfaga aparte.
   */
  private readonly detector = new ScanDetector();

  /**
   * El escaneo ya buscó este texto: sin esta marca, el timer de las teclas de la
   * ráfaga reabre el panel sobre un campo ya resuelto.
   */
  private scanHandled = false;

  constructor() {
    super();

    // RFE-01: la espera es un token leído por emisión (por eso `debounce` y no
    // `debounceTime`). Sin token es cero: una consulta por tecla, no una constante inventada.
    this.typed
      .pipe(
        debounce(() => timer(readMilliseconds(DELAY_SEARCH_INPUT_TOKEN) ?? 0)),
        takeUntilDestroyed(),
      )
      .subscribe((query) => {
        if (this.scanHandled) {
          this.scanHandled = false;
          return;
        }
        this.request({ query, page: 0, append: false, scan: false });
      });

    // RFE-01: `switchMap` cancela la consulta en vuelo; si no, una respuesta lenta
    // de otro texto pinta resultados viejos sobre frescos (PACQ-01.2).
    this.requests
      .pipe(
        tap((request) => this.onRequestStart(request)),
        switchMap((request) => this.run(request)),
        takeUntilDestroyed(),
      )
      .subscribe();

    // La caja sigue al valor. Atarla a `chosen ?? typed` falla: tras elegir una vez,
    // la etiqueta vieja pisaría cada tecla siguiente.
    effect(() => {
      const chosen = this.controlValue();
      this.text.set(chosen === null ? '' : this.display().label(chosen));
    });
  }

  ngOnDestroy(): void {
    this.close();
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  protected readonly effectiveState = computed<FieldState>(() => {
    if (this.isDisabled()) {
      return 'disabled';
    }
    return this.error() || this.status() === 'error' ? 'error' : 'default';
  });

  protected readonly borderColor = computed(() =>
    fieldBorderColor(this.effectiveState(), this.isOpen()),
  );

  protected readonly fieldClasses = computed(() =>
    [
      this.baseClasses,
      FIELD_HEIGHT_CLASSES[this.size()],
      FIELD_PADDING_CLASSES[this.size()],
      fieldSurfaceClasses(this.effectiveState()),
    ].join(' '),
  );

  protected readonly fontSize = computed(() => FIELD_FONT_SIZES[this.size()]);

  protected readonly hintClasses = computed(() =>
    this.effectiveState() === 'error' ? 'text-danger' : 'text-secondary',
  );

  protected readonly describedBy = computed(() => {
    const ids = [this.statusId];
    if (this.hint()) {
      ids.push(this.hintId);
    }
    if (this.status() === 'error') {
      ids.push(this.errorId);
    }
    return ids.join(' ');
  });

  protected readonly controlsId = computed(() => (this.isOpen() ? this.listboxId : null));

  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.isOpen() && index >= 0 ? this.optionId(index) : null;
  });

  /** Filas que alcanzan las flechas; «cargar más» cuenta, por eso es alcanzable con teclado. */
  protected readonly rowCount = computed(() => this.items().length + (this.hasMore() ? 1 : 0));

  protected isMoreRow(index: number): boolean {
    return this.hasMore() && index === this.items().length;
  }

  protected optionId(index: number): string {
    return `${this.fieldId}-option-${index}`;
  }

  protected optionClasses(index: number): string {
    return listboxOptionClasses(false, index === this.activeIndex());
  }

  protected labelOf(item: T): string {
    return this.display().label(item);
  }

  /** RFE-08: la región viva anuncia el cambio de lista, porque el foco nunca se mueve. */
  protected readonly announcement = computed(() => {
    const messages = this.words();
    switch (this.status()) {
      case 'searching':
        return messages.searching;
      case 'empty':
        return messages.noResults(this.searchedText());
      case 'error':
        return messages.error;
      case 'ready':
        return messages.results(this.items().length, this.total());
      case 'idle':
        return '';
    }
  });

  private request(request: SearchRequest): void {
    this.requests.next(request);
  }

  private onRequestStart(request: SearchRequest): void {
    this.lastRequest = request;
    this.searchedText.set(request.query);
    this.status.set('searching');
    if (!request.append) {
      // Se limpia todo, no solo las filas: un `hasMore` viejo ofrecía la página 2
      // de una búsqueda que ya no existe (PACQ-04.2).
      this.items.set([]);
      this.hasMore.set(false);
      this.total.set(null);
      this.activeIndex.set(-1);
    }
    // RFE-01: se abre solo, salvo un escaneo, que intenta resolver sin panel.
    if (!request.scan) {
      this.open();
    }
  }

  /** Nunca emite error: uno que escape mata la suscripción y el campo ya no busca más. */
  private run(request: SearchRequest) {
    const waited = readMilliseconds(TIMEOUT_SEARCH_TOKEN);
    const query = this.source().search(request.query, request.page);
    return (waited === null ? query : query.pipe(timeout({ first: waited }))).pipe(
      map((page) => {
        this.items.update((current) =>
          request.append ? [...current, ...page.items] : [...page.items],
        );
        this.hasMore.set(page.hasMore);
        this.total.set(page.total);
        this.status.set(this.items().length === 0 ? 'empty' : 'ready');
        this.afterResults(request);
        return page;
      }),
      // RFE-02: un timeout es error del servicio, no «sin resultados»; mezclarlos
      // hace que una caída parezca un depósito vacío.
      catchError(() => {
        this.status.set('error');
        // El error va bajo el campo, donde Tab alcanza el reintento (PACQ-03.2).
        this.close();
        return EMPTY;
      }),
    );
  }

  /** RFE-06: un escaneo con un único registro exacto lo elige sin abrir el panel. */
  private afterResults(request: SearchRequest): void {
    if (!request.scan) {
      return;
    }
    const code = this.display().code;
    const only = this.items().length === 1 ? this.items()[0] : undefined;
    if (only !== undefined && code && equalsIgnoringCase(code(only), request.query)) {
      this.choose(only);
      return;
    }
    this.open();
  }

  protected open(): void {
    if (this.isDisabled() || this.isOpen()) {
      return;
    }
    const overlayRef = (this.overlayRef ??= this.createOverlay());
    overlayRef.updateSize({ width: this.field().nativeElement.getBoundingClientRect().width });
    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);
  }

  private createOverlay(): OverlayRef {
    const overlayRef = createConnectedOverlay(
      this.injector,
      this.field().nativeElement,
      PANEL_POSITIONS,
    );
    overlayRef.outsidePointerEvents().subscribe(() => this.close());
    return overlayRef;
  }

  /** Cierra sin tocar el valor; toda salida pasa por acá. */
  protected close(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    if (value === '') {
      // RFE-03: vaciar la caja no busca ni borra el valor elegido.
      this.status.set('idle');
      this.items.set([]);
      this.hasMore.set(false);
      this.close();
      return;
    }
    this.typed.next(value);
  }

  /** RFE-06: la ráfaga se mide acá, con umbral en token; el DS no puede importar `core/keyboard/`. */
  protected onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }

    const isScan =
      this.detector.accept(event, readMilliseconds(SCAN_THRESHOLD_TOKEN)).kind === 'scan';

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.isOpen()) {
          this.activeIndex.set(moveActiveIndex(this.activeIndex(), 1, this.rowCount()));
        } else if (this.text()) {
          this.open();
        }
        return;

      case 'ArrowUp':
        event.preventDefault();
        if (this.isOpen()) {
          this.activeIndex.set(moveActiveIndex(this.activeIndex(), -1, this.rowCount()));
        }
        return;

      case 'Enter':
        if (isScan) {
          // Busca ya, sin la espera: 300 ms tras un código completo son un operario parado.
          event.preventDefault();
          this.scanHandled = true;
          this.request({ query: this.text(), page: 0, append: false, scan: true });
          return;
        }
        if (this.isOpen() && this.activeIndex() >= 0) {
          event.preventDefault();
          this.activate(this.activeIndex());
        }
        // Si no, el Enter es del formulario: tragarlo rompe enviar con teclado.
        return;

      case 'Escape':
        if (this.isOpen()) {
          event.preventDefault();
          this.close();
        }
        return;

      case 'Tab':
        this.close();
        return;

      default:
        return;
    }
  }

  protected activate(index: number): void {
    if (this.isMoreRow(index)) {
      this.loadMore();
      return;
    }
    const item = this.items()[index];
    if (item !== undefined) {
      this.choose(item);
    }
  }

  /** El único camino que cambia el valor; Escape, Tab y clic afuera van a `close()`. */
  protected choose(item: T): void {
    this.commit(item);
    this.close();
    this.markTouched();
  }

  /** RFE-05: la página siguiente se agrega, nunca reemplaza. */
  protected loadMore(): void {
    const request = this.lastRequest;
    if (!request || !this.hasMore()) {
      return;
    }
    this.request({ ...request, page: request.page + 1, append: true, scan: false });
  }

  /** RFE-04: repite la última consulta, mismo texto y misma página. */
  protected retry(): void {
    if (this.lastRequest) {
      this.request({ ...this.lastRequest, scan: false });
    }
  }

  protected onOptionMousedown(event: MouseEvent): void {
    // El foco no puede salir del campo, y se mueve en mousedown.
    event.preventDefault();
  }

  protected onOptionEnter(index: number): void {
    this.activeIndex.set(index);
  }

  /** Repone la etiqueta del valor real: texto a medio tipear mentiría sobre él (RFE-03). */
  protected onBlur(): void {
    const chosen = this.controlValue();
    this.text.set(chosen === null ? '' : this.display().label(chosen));
    this.markTouched();
  }

  /** RFE-01: volver al campo reabre el panel si hay resultados, sin retipear. */
  protected onFocus(): void {
    if (this.text() && this.items().length > 0) {
      this.open();
    }
  }
}

/**
 * REQ-FE-DS3-001 §8: exacta sin mayúsculas, nada más. Los caracteres de control que
 * anteponen algunos lectores son decisión abierta (§15).
 */
function equalsIgnoringCase(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
