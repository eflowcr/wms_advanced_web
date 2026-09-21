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
  isDevMode,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, of, Subject, timer } from 'rxjs';
import { catchError, debounce, map, switchMap, tap, timeout } from 'rxjs/operators';
import {
  FIELD_BASE_CLASSES,
  FIELD_FONT_SIZES,
  FIELD_HEIGHT_CLASSES,
  FIELD_ICON_SIZE,
  FIELD_PADDING_CLASSES,
  fieldBorderColor,
  fieldSurfaceClasses,
  type FieldSize,
  type FieldState,
} from '../field/field.types';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { Icon } from '../icon/icon';
import { ScanDetector } from '../keyboard/scan-detector';
import { moveActiveIndex } from '../listbox/listbox.types';
import { createConnectedOverlay, PANEL_POSITIONS } from '../overlay/connected-overlay';
import { readMilliseconds } from '../tokens/read-token';
import { memorySource, type SearchDisplay, type SearchSource } from './search-source';
import {
  DELAY_SEARCH_INPUT_TOKEN,
  EWMS_SELECT_MESSAGES,
  NO_SELECT_MESSAGES,
  SCAN_THRESHOLD_TOKEN,
  SEARCH_MORE_CLASSES,
  SEARCH_NOTE_CLASSES,
  SELECT_PANEL_CLASSES,
  SELECT_SEARCH_THRESHOLD,
  SELECT_SELECTED_WEIGHT,
  SELECT_TYPEAHEAD_RESET_MS,
  selectOptionClasses,
  TIMEOUT_SEARCH_TOKEN,
  type SearchStatus,
  type SelectMessages,
  type SelectOption,
  type SelectSearchable,
} from './select.types';

export type { SearchDisplay, SearchPage, SearchSource } from './search-source';
export type { SearchStatus, SelectMessages, SelectOption, SelectSearchable } from './select.types';

let nextSelectId = 0;

interface SearchRequest {
  readonly query: string;
  readonly page: number;
  readonly append: boolean;
  /** Vino de una ráfaga de escáner: resuelve sin abrir el panel si puede. */
  readonly scan: boolean;
}

/**
 * Un solo selector (decisión del usuario, 2026-09-21). Lista corta: gatillo `<button>`, combobox
 * de solo selección. Lista larga o `source`: un `<input>` que filtra (REQ-FE-DS3-001). En los dos
 * el foco no sale del campo y `aria-activedescendant` marca la fila. Ver vault: Select.
 */
@Component({
  selector: 'ewms-select',
  templateUrl: './select.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [provideValueAccessor(() => Select)],
})
export class Select<T = unknown> extends FormControlBase<unknown> implements OnInit, OnDestroy {
  /** Lista cerrada en memoria: `SelectOption`, o registros con `display`. */
  readonly options = input<readonly SelectOption[] | readonly T[] | null>(null);

  /** Fuente del backend; excluye a `options`. Pasar a un backend real cambia solo esto. */
  readonly source = input<SearchSource<T> | null>(null);

  /** Con `display`, el valor es el registro; sin él, `SelectOption.value`. */
  readonly display = input<SearchDisplay<T> | null>(null);

  readonly searchable = input<SelectSearchable>('auto');

  /** Siembra el control; después manda `writeValue`. */
  readonly value = input<unknown>(null);

  readonly size = input<FieldSize>('md');
  readonly label = input.required<string>();
  readonly placeholder = input<string>('');
  readonly hint = input<string>('');

  /** Solo visual: valida el formulario de arriba. */
  readonly error = input<boolean>(false);

  /** Pisa, en esta instancia, los textos de `EWMS_SELECT_MESSAGES` (ADR 0008). */
  readonly messages = input<Partial<SelectMessages> | null>(null);

  private readonly providedMessages = inject(EWMS_SELECT_MESSAGES, { optional: true });

  /** `words` y no `text`: `text` es lo tipeado, y dos nombres casi iguales ya confundieron. */
  protected readonly words = computed<SelectMessages>(() => ({
    ...(this.providedMessages ?? NO_SELECT_MESSAGES),
    ...(this.messages() ?? {}),
  }));

  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef: OverlayRef | null = null;

  private readonly id = ++nextSelectId;
  protected readonly fieldId = `ewms-select-${this.id}`;
  protected readonly labelId = `${this.fieldId}-label`;
  protected readonly listboxId = `${this.fieldId}-listbox`;
  protected readonly hintId = `${this.fieldId}-hint`;
  protected readonly statusId = `${this.fieldId}-status`;
  protected readonly errorId = `${this.fieldId}-error`;

  protected readonly valueSource = this.value;

  protected readonly searching = computed(() => {
    const searchable = this.searchable();
    if (searchable !== 'auto') {
      return searchable;
    }
    return this.source() !== null || (this.options()?.length ?? 0) > SELECT_SEARCH_THRESHOLD;
  });

  protected readonly text = signal('');
  protected readonly items = signal<readonly unknown[]>([]);
  protected readonly status = signal<SearchStatus>('idle');
  protected readonly hasMore = signal(false);
  protected readonly total = signal<number | null>(null);
  protected readonly isOpen = signal(false);

  /** -1 es «en ningún lado». */
  protected readonly activeIndex = signal(-1);

  /** Para el mensaje «sin resultados para X». */
  protected readonly searchedText = signal('');

  /** RFE-04: el reintento repite esta petición tal cual. */
  private lastRequest: SearchRequest | null = null;

  protected readonly panelClasses = SELECT_PANEL_CLASSES;
  protected readonly noteClasses = SEARCH_NOTE_CLASSES;
  protected readonly moreClasses = SEARCH_MORE_CLASSES;
  protected readonly selectedWeight = SELECT_SELECTED_WEIGHT;
  protected readonly iconSize = FIELD_ICON_SIZE;

  private readonly typed = new Subject<string>();
  private readonly requests = new Subject<SearchRequest>();

  /** El detector compartido, no una copia; una instancia por campo, cada uno es una ráfaga. */
  private readonly detector = new ScanDetector();

  /** El escaneo ya buscó este texto: sin la marca, el timer de la ráfaga reabre el panel. */
  private scanHandled = false;

  private typeahead = { buffer: '', at: 0 };

  /** La lista en memoria como fuente: un solo motor de búsqueda para los dos orígenes. */
  private readonly localSource = computed(() =>
    memorySource<unknown>(this.options() ?? [], (item) => this.labelOf(item)),
  );

  constructor() {
    super();

    // RFE-01: la espera es un token leído por emisión. En memoria no hay espera: no hay red.
    this.typed
      .pipe(
        debounce(() =>
          this.source() ? timer(readMilliseconds(DELAY_SEARCH_INPUT_TOKEN) ?? 0) : of(0),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((query) => {
        if (this.scanHandled) {
          this.scanHandled = false;
          return;
        }
        this.request({ query, page: 0, append: false, scan: false });
      });

    // RFE-01: `switchMap` cancela la consulta en vuelo; si no, una respuesta lenta de otro
    // texto pinta resultados viejos sobre frescos (PACQ-01.2).
    this.requests
      .pipe(
        tap((request) => this.onRequestStart(request)),
        switchMap((request) => this.run(request)),
        takeUntilDestroyed(),
      )
      .subscribe();

    // La caja sigue al valor. Atarla a `chosen ?? typed` falla: la etiqueta vieja pisaría cada tecla.
    effect(() => this.text.set(this.selectedLabel() ?? ''));
  }

  ngOnInit(): void {
    if (isDevMode() && this.options() !== null && this.source() !== null) {
      throw new Error('ewms-select: pass options or source, never both.');
    }
  }

  ngOnDestroy(): void {
    this.close();
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  /** Las filas del panel: la lista entera, o lo que devolvió la búsqueda. */
  protected readonly rows = computed<readonly unknown[]>(() =>
    this.searching() ? this.items() : (this.options() ?? []),
  );

  protected labelOf(item: unknown): string {
    const display = this.display();
    return display ? display.label(item as T) : (item as SelectOption).label;
  }

  private valueFor(item: unknown): unknown {
    return this.display() ? item : (item as SelectOption).value;
  }

  protected readonly selectedLabel = computed(() => {
    const chosen = this.controlValue();
    if (chosen === null || chosen === undefined) {
      return null;
    }
    const display = this.display();
    if (display) {
      return display.label(chosen as T);
    }
    const found = (this.options() ?? []).find((item) => this.valueFor(item) === chosen);
    return found === undefined ? null : this.labelOf(found);
  });

  protected readonly selectedIndex = computed(() =>
    this.rows().findIndex((item) => this.valueFor(item) === this.controlValue()),
  );

  /** Lista cerrada: con la flecha se ve que despliega. Con `source` es un buscador. */
  protected readonly hasChevron = computed(() => this.source() === null);

  protected readonly effectiveState = computed<FieldState>(() => {
    if (this.isDisabled()) {
      return 'disabled';
    }
    return this.error() || this.status() === 'error' ? 'error' : 'default';
  });

  /** Abierto toma el borde de foco: el foco está en el campo. */
  protected readonly borderColor = computed(() =>
    fieldBorderColor(this.effectiveState(), this.isOpen()),
  );

  protected readonly fieldClasses = computed(() =>
    [
      FIELD_BASE_CLASSES,
      FIELD_HEIGHT_CLASSES[this.size()],
      FIELD_PADDING_CLASSES[this.size()],
      fieldSurfaceClasses(this.effectiveState()),
      this.searching()
        ? this.hasChevron()
          ? 'pr-9'
          : ''
        : 'flex items-center justify-between gap-2 text-left',
      !this.searching() && !this.isDisabled() ? 'cursor-pointer' : '',
    ]
      .join(' ')
      .trim(),
  );

  protected readonly fontSize = computed(() => FIELD_FONT_SIZES[this.size()]);

  protected readonly hintClasses = computed(() =>
    this.effectiveState() === 'error' ? 'text-danger' : 'text-secondary',
  );

  protected readonly describedBy = computed(() => {
    const ids = this.searching() ? [this.statusId] : [];
    if (this.hint()) {
      ids.push(this.hintId);
    }
    if (this.status() === 'error') {
      ids.push(this.errorId);
    }
    return ids.length ? ids.join(' ') : null;
  });

  /** Solo mientras existe el panel: un id fuera del documento es peor que ninguno. */
  protected readonly controlsId = computed(() => (this.isOpen() ? this.listboxId : null));

  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.isOpen() && index >= 0 ? this.optionId(index) : null;
  });

  /** Filas que alcanzan las flechas; «cargar más» cuenta, por eso es alcanzable con teclado. */
  protected readonly rowCount = computed(() => this.rows().length + (this.hasMore() ? 1 : 0));

  protected isMoreRow(index: number): boolean {
    return this.hasMore() && index === this.rows().length;
  }

  protected optionId(index: number): string {
    return `${this.fieldId}-option-${index}`;
  }

  protected optionClasses(index: number): string {
    return selectOptionClasses(index === this.selectedIndex(), index === this.activeIndex());
  }

  /** RFE-08: la región viva anuncia el cambio de lista, porque el foco nunca se mueve. */
  protected readonly announcement = computed(() => {
    const words = this.words();
    switch (this.status()) {
      case 'searching':
        return words.searching;
      case 'empty':
        return words.noResults(this.searchedText());
      case 'error':
        return words.error;
      case 'ready':
        return words.results(this.items().length, this.total());
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
      // Se limpia todo: un `hasMore` viejo ofrecía la página 2 de otra búsqueda (PACQ-04.2).
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
    const remote = this.source();
    const query = (remote ?? this.localSource()).search(request.query, request.page);
    const waited = remote ? readMilliseconds(TIMEOUT_SEARCH_TOKEN) : null;
    return (waited === null ? query : query.pipe(timeout({ first: waited }))).pipe(
      map((page) => {
        this.items.update((current) =>
          request.append ? [...current, ...page.items] : [...page.items],
        );
        this.hasMore.set(page.hasMore);
        this.total.set(page.total);
        this.status.set(this.items().length === 0 ? 'empty' : 'ready');
        if (!request.append && !request.scan && this.selectedIndex() >= 0) {
          this.activeIndex.set(this.selectedIndex());
        }
        this.afterResults(request);
        return page;
      }),
      // RFE-02: un timeout es error del servicio, no «sin resultados».
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
    const code = this.display()?.code;
    const only = this.items().length === 1 ? this.items()[0] : undefined;
    if (only !== undefined && code && equalsIgnoringCase(code(only as T), request.query)) {
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
    // Ancho del campo leído al abrir, no guardado: cambia con el layout.
    overlayRef.updateSize({ width: this.anchor().nativeElement.getBoundingClientRect().width });
    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    if (!this.searching()) {
      // Siempre hay fila activa al abrir; si no, la flecha abajo pediría otra pulsación.
      this.activeIndex.set(Math.max(0, this.selectedIndex()));
    }
    this.isOpen.set(true);
  }

  /** Se arma una vez: suscribirse en cada `open()` apilaría un listener por apertura. */
  private createOverlay(): OverlayRef {
    const overlayRef = createConnectedOverlay(
      this.injector,
      this.anchor().nativeElement,
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

  /** Lista en memoria: abrir muestra todo, sin tener que escribir. */
  private showAll(): void {
    this.request({ query: '', page: 0, append: false, scan: false });
  }

  protected onTriggerClick(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected onFieldClick(): void {
    if (!this.isOpen() && this.source() === null) {
      this.showAll();
    }
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    if (value === '' && this.source() !== null) {
      // RFE-03: vaciar la caja no busca ni borra el valor elegido.
      this.status.set('idle');
      this.items.set([]);
      this.hasMore.set(false);
      this.close();
      return;
    }
    this.typed.next(value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }
    if (this.searching()) {
      this.onSearchKeydown(event);
    } else {
      this.onTriggerKeydown(event);
    }
  }

  private onTriggerKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (this.isOpen()) {
          this.moveActive(event.key === 'ArrowDown' ? 1 : -1);
        } else {
          this.open();
        }
        return;
      case 'Enter':
        if (this.isOpen()) {
          // Si no, el clic del gatillo reabriría el panel.
          event.preventDefault();
          this.activate(this.activeIndex());
        }
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
        this.typeAhead(event);
    }
  }

  /** APG: una letra lleva a la primera opción que empieza así; seguir tecleando afina. */
  private typeAhead(event: KeyboardEvent): void {
    const now = Date.now();
    const continuing =
      this.typeahead.buffer !== '' && now - this.typeahead.at <= SELECT_TYPEAHEAD_RESET_MS;
    const modified = event.ctrlKey || event.metaKey || event.altKey;
    // El espacio abre el panel, salvo a mitad de palabra, donde es una letra más.
    if (event.key.length !== 1 || modified || (event.key === ' ' && !continuing)) {
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
    }
    const buffer = continuing ? this.typeahead.buffer + event.key : event.key;
    this.typeahead = { buffer, at: now };
    const needle = buffer.toLowerCase();
    const index = this.rows().findIndex((item) => this.labelOf(item).toLowerCase().startsWith(needle));
    if (index >= 0) {
      this.open();
      this.activeIndex.set(index);
    }
  }

  /** RFE-06: la ráfaga se mide acá, con umbral en token; el DS no puede importar `core/keyboard/`. */
  private onSearchKeydown(event: KeyboardEvent): void {
    const isScan =
      this.detector.accept(event, readMilliseconds(SCAN_THRESHOLD_TOKEN)).kind === 'scan';

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.isOpen()) {
          this.moveActive(1);
        } else if (this.source() === null) {
          this.showAll();
        } else if (this.text()) {
          this.open();
        }
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (this.isOpen()) {
          this.moveActive(-1);
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

  /** La regla (frena en los extremos) vive en `listbox/`. */
  private moveActive(delta: number): void {
    this.activeIndex.set(moveActiveIndex(this.activeIndex(), delta, this.rowCount()));
  }

  protected activate(index: number): void {
    if (this.isMoreRow(index)) {
      this.loadMore();
      return;
    }
    const item = this.rows()[index];
    if (item !== undefined) {
      this.choose(item);
    }
  }

  /** El único camino que cambia el valor; Escape, Tab y clic afuera van a `close()`. */
  protected choose(item: unknown): void {
    this.commit(this.valueFor(item));
    this.text.set(this.labelOf(item));
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

  /** El foco se mueve en mousedown: prevenirlo lo deja en el campo. */
  protected onOptionMousedown(event: MouseEvent): void {
    event.preventDefault();
  }

  protected onOptionEnter(index: number): void {
    this.activeIndex.set(index);
  }

  /** Repone la etiqueta del valor real: texto a medio tipear mentiría sobre él (RFE-03). */
  protected onBlur(): void {
    this.text.set(this.selectedLabel() ?? '');
    this.markTouched();
  }

  /** RFE-01: volver al campo reabre el panel si hay resultados, sin retipear. */
  protected onFocus(): void {
    if (this.source() !== null && this.text() && this.items().length > 0) {
      this.open();
    }
  }
}

/** REQ-FE-DS3-001 §8: exacta sin mayúsculas, nada más. */
function equalsIgnoringCase(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
