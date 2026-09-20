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

/** Una consulta, con todo lo que hace falta para correrla y para reintentarla. */
interface SearchRequest {
  readonly query: string;
  readonly page: number;
  /** Agrega a lo que ya está en pantalla en vez de reemplazarlo. */
  readonly append: boolean;
  /** Vino de una ráfaga de escáner: resuelve sin abrir el panel si puede. */
  readonly scan: boolean;
}

/**
 * Un campo que se tipea y filtra contra una fuente. NO es un `ewms-select`
 * mejor, es el caso opuesto: un depósito tiene decenas de miles de SKU y abrir
 * un panel para caminarlo con las flechas es imposible, no lento. El valor es el
 * REGISTRO, nunca el texto. Ficha: 08-Sistema-de-Diseno/Componentes/Search-Select.
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
  /**
   * De dónde salen los registros. Una INTERFAZ, nunca un endpoint: pasar de la
   * fuente de demo a un backend real cambia un `SearchSource` y nada más.
   */
  readonly source = input.required<SearchSource<T>>();

  /** Cómo un registro se vuelve texto, y contra qué se compara un código escaneado. */
  readonly display = input.required<SearchDisplay<T>>();

  /** El registro elegido. Siembra el control; después manda `writeValue`. */
  readonly value = input<T | null>(null);

  readonly size = input<FieldSize>('md');

  /** Obligatoria y visible, como la de cualquier otro campo. */
  readonly label = input.required<string>();

  readonly placeholder = input<string>('');

  /** Texto de ayuda bajo el campo. Se pinta de peligro cuando hay `error`. */
  readonly hint = input<string>('');

  /** Solo visual. Este componente no valida nada; decide el formulario de arriba. */
  readonly error = input<boolean>(false);

  /**
   * Los textos de los estados, YA PROVISTOS por `EWMS_SEARCH_SELECT_MESSAGES`;
   * esta entrada los pisa para una instancia. El sistema de diseño no habla
   * ningún idioma y no importa i18n (ADR 0008): pide una interfaz.
   */
  readonly messages = input<Partial<SearchSelectMessages> | null>(null);

  private readonly providedMessages = inject(EWMS_SEARCH_SELECT_MESSAGES);

  /**
   * El diccionario provisto, con lo de esta instancia encima. Se llama `words` y
   * no `text` porque `text` ya es LO QUE ALGUIEN TIPEÓ, y dos miembros a una
   * letra que significan lo opuesto es cómo la caja termina diciendo «Buscando…».
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

  /** La consulta que muestra el panel, para el mensaje «sin resultados para X». */
  protected readonly searchedText = signal('');

  /** La última petición, para que el reintento la repita igual (RFE-04). */
  private lastRequest: SearchRequest | null = null;

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly panelClasses = LISTBOX_PANEL_CLASSES;
  protected readonly noteClasses = SEARCH_NOTE_CLASSES;
  protected readonly moreClasses = SEARCH_MORE_CLASSES;
  protected readonly selectedWeight = LISTBOX_SELECTED_WEIGHT;

  /** Texto tipeado, antes de la espera. */
  private readonly typed = new Subject<string>();
  /** Consultas, después de la espera o directo desde un escaneo. */
  private readonly requests = new Subject<SearchRequest>();

  // ------------------------------------------------------ deteccion de escaneo

  /**
   * EL DETECTOR COMPARTIDO, no una segunda implementación. Dos respuestas a «¿es
   * una pistola?» derivan, y la mitad que deriva dispara un atajo en medio de un
   * escaneo. Una INSTANCIA por campo: dos campos son dos ráfagas independientes.
   */
  private readonly detector = new ScanDetector();

  /**
   * Un escaneo ya buscó este texto, así que la consulta demorada detrás nace
   * vieja. Sin esto el escaneo resuelve, elige, y el timer que dejaron las
   * teclas de la ráfaga reabre el panel sobre un campo ya terminado.
   */
  private scanHandled = false;

  constructor() {
    super();

    /*
     * RFE-01: entre la última tecla y la consulta hay una espera, y es un token.
     * `debounce` con timer y no `debounceTime`, porque el token se lee por
     * emisión. Sin token la espera es cero -una consulta por tecla, ruidosa pero
     * correcta- y no una constante inventada acá.
     */
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

    /*
     * RFE-01, la mitad que importa: `switchMap` CANCELA la consulta en vuelo. Sin
     * él una página 0 lenta aterriza después de una rápida de otro texto y pinta
     * resultados viejos sobre frescos (PACQ-01.2).
     */
    this.requests
      .pipe(
        tap((request) => this.onRequestStart(request)),
        switchMap((request) => this.run(request)),
        takeUntilDestroyed(),
      )
      .subscribe();

    /*
     * LO QUE HAY EN LA CAJA SIGUE AL VALOR, con una sola fuente de verdad. Atar el
     * campo a `chosen ?? typed` parece más simple y está mal: después de elegir
     * una vez, cada tecla siguiente la pisaría la etiqueta vieja.
     */
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

  // ------------------------------------------------------------------ aspecto

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

  /**
   * Cuántas filas alcanzan las flechas: los resultados más la de «cargar más».
   * Esa fila se alcanza con el teclado PORQUE se cuenta acá: es una fila de la
   * lista, no un botón al lado.
   */
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

  /**
   * Lo que dice la región viva. RFE-08: un lector de pantalla tiene que enterarse
   * de que la lista cambió sin que el foco se mueva, porque nunca se mueve.
   */
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

  // --------------------------------------------------------------- consultas

  private request(request: SearchRequest): void {
    this.requests.next(request);
  }

  private onRequestStart(request: SearchRequest): void {
    this.lastRequest = request;
    this.searchedText.set(request.query);
    this.status.set('searching');
    if (!request.append) {
      /*
       * SE VA TODO lo de la respuesta anterior, no solo las filas: un `hasMore`
       * viejo dejaba la fila «cargar más» ofreciendo la página 2 de una búsqueda
       * que ya no existe (PACQ-04.2).
       */
      this.items.set([]);
      this.hasMore.set(false);
      this.total.set(null);
      this.activeIndex.set(-1);
    }
    // Un escaneo resuelve sin panel cuando puede, así que no abre uno de paso.
    // Todo lo demás abre: RFE-01 dice que la persona nunca tiene que hacerlo.
    if (!request.scan) {
      this.open();
    }
  }

  /**
   * Corre una petición. NUNCA FALLA: un error se vuelve el ESTADO de error,
   * porque uno que escape de la tubería mata la suscripción y deja al componente
   * sin poder volver a buscar.
   */
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
      /*
       * RFE-02: un timeout es un ERROR DEL SERVICIO, no una ausencia de registros.
       * Nunca comparten rama: confundirlos hace que una caída parezca un depósito
       * vacío.
       */
      catchError(() => {
        this.status.set('error');
        // El panel no tiene nada que mostrar, y el error se pinta bajo el campo,
        // donde un Tab alcanza su botón de reintento (PACQ-03.2).
        this.close();
        return EMPTY;
      }),
    );
  }

  /**
   * RFE-06: un escaneo que identificó exactamente un registro lo elige sin haber
   * abierto el panel. Cualquier otra cosa se comporta como una búsqueda común.
   */
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

  // ----------------------------------------------------------- abrir y cerrar

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

  /** Cierra SIN tocar el valor. Toda salida pasa por acá. */
  protected close(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  // ------------------------------------------------------------------ tipeo

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    if (value === '') {
      // Vaciar la caja no es buscar. RFE-03: tampoco borra el valor elegido; eso
      // solo lo hace elegir otro registro.
      this.status.set('idle');
      this.items.set([]);
      this.hasMore.set(false);
      this.close();
      return;
    }
    this.typed.next(value);
  }

  /**
   * RFE-06, primera mitad: reconocer una ráfaga. La medición es local y el umbral
   * es un token, y el REQ lo permite: el sistema de diseño no puede importar
   * `core/keyboard/`.
   */
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
          /*
           * Una ráfaga que cierra con Enter busca YA, sin la espera: esperar 300 ms
           * después de que la pistola entregó el código entero son 300 ms de un
           * operario parado.
           */
          event.preventDefault();
          this.scanHandled = true;
          this.request({ query: this.text(), page: 0, append: false, scan: true });
          return;
        }
        if (this.isOpen() && this.activeIndex() >= 0) {
          event.preventDefault();
          this.activate(this.activeIndex());
        }
        // Si no, el Enter es del formulario alrededor. Tragárselo rompería enviar
        // un formulario desde el teclado.
        return;

      case 'Escape':
        if (this.isOpen()) {
          // Solo descarta: el valor no cambia, y el foco ya está en el campo y se
          // queda.
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

  // ---------------------------------------------------------------- elegir

  /** Se activó una fila: un resultado, o la de «cargar más». */
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

  /**
   * Confirma un registro y cierra. El único camino que cambia el valor: Escape,
   * Tab y un clic afuera terminan todos en `close()`.
   */
  protected choose(item: T): void {
    this.commit(item);
    this.close();
    this.markTouched();
  }

  /** RFE-05: la página siguiente se AGREGA, nunca reemplaza. */
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

  /**
   * Salir del campo repone lo que se eligió de verdad. Texto a medio tipear con
   * el formulario guardando otro registro es un campo que miente sobre su valor,
   * y vaciar la caja NO es borrar el valor (RFE-03).
   */
  protected onBlur(): void {
    const chosen = this.controlValue();
    this.text.set(chosen === null ? '' : this.display().label(chosen));
    this.markTouched();
  }

  /**
   * RFE-01: el panel aparece solo. Hacer clic en el campo lo reabre cuando hay
   * algo que mostrar, así quien se fue y volvió no tiene que retipear.
   */
  protected onFocus(): void {
    if (this.text() && this.items().length > 0) {
      this.open();
    }
  }
}

/**
 * Coincidencia exacta sin distinguir mayúsculas, que es la definición de código
 * escaneado de REQ-FE-DS3-001 §8. Nada más se normaliza: los caracteres de
 * control que anteponen algunos lectores son una decisión abierta (§15).
 */
function equalsIgnoringCase(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
