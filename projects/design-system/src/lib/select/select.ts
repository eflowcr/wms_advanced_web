import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,

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
import { of, Subject, timer } from 'rxjs';
import { debounce } from 'rxjs/operators';
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
import { EmptyState } from '../empty-state/empty-state';
import { Icon } from '../icon/icon';
import { ScanDetector } from '../keyboard/scan-detector';
import { moveActiveIndex } from '../listbox/listbox.types';
import { createConnectedOverlay, PANEL_POSITIONS } from '../overlay/connected-overlay';
import { readMilliseconds } from '../tokens/read-token';
import { memorySource, type SearchDisplay, type SearchSource } from './search-source';
import { SelectSearch, type SearchRequest } from './select-search';
import {
  DELAY_SEARCH_INPUT_TOKEN,
  EWMS_SELECT_MESSAGES,
  NO_SELECT_MESSAGES,
  SCAN_THRESHOLD_TOKEN,
  SEARCH_MORE_CLASSES,
  SEARCH_NOTE_CLASSES,
  SELECT_PANEL_CLASSES,
  SELECT_SELECTED_WEIGHT,
  selectOptionClasses,
  TIMEOUT_SEARCH_TOKEN,
  type SelectMessages,
  type SelectOption,
} from './select.types';

export type { SearchDisplay, SearchPage, SearchSource } from './search-source';
export type { SearchStatus, SelectMessages, SelectOption } from './select.types';

let nextSelectId = 0;

/**
 * El único selector, y siempre busca (decisión del usuario, 2026-09-22): un `<input>` combobox
 * con chevron. `options` filtra en memoria; `source` pagina en el backend (REQ-FE-DS3-001).
 * El foco no sale del campo y `aria-activedescendant` marca la fila. Ver vault: Select.
 */
@Component({
  selector: 'ewms-select',
  templateUrl: './select.html',
  imports: [EmptyState, Icon],
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

  protected readonly text = signal('');
  protected readonly isOpen = signal(false);

  /** -1 es «en ningún lado». */
  protected readonly activeIndex = signal(-1);

  /** Filas, estado y páginas de la última búsqueda, local o remota. */
  protected readonly search = new SelectSearch({
    search: (query, page) => (this.source() ?? this.localSource()).search(query, page),
    timeoutMs: () => (this.source() ? readMilliseconds(TIMEOUT_SEARCH_TOKEN) : null),
    started: (request) => this.onSearchStart(request),
    arrived: (request) => this.onSearchArrived(request),
    // El error va bajo el campo, donde Tab alcanza el reintento (PACQ-03.2).
    failed: () => this.close(),
  });
  protected readonly rows = this.search.rows;

  protected readonly panelClasses = SELECT_PANEL_CLASSES;
  protected readonly noteClasses = SEARCH_NOTE_CLASSES;
  protected readonly moreClasses = SEARCH_MORE_CLASSES;
  protected readonly selectedWeight = SELECT_SELECTED_WEIGHT;
  protected readonly iconSize = FIELD_ICON_SIZE;

  private readonly typed = new Subject<string>();

  /** El detector compartido, no una copia; una instancia por campo, cada uno es una ráfaga. */
  private readonly detector = new ScanDetector();

  /** El escaneo ya buscó este texto: sin la marca, el timer de la ráfaga reabre el panel. */
  private scanHandled = false;

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
        this.search.find(query);
      });

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

  protected readonly effectiveState = computed<FieldState>(() => {
    if (this.isDisabled()) {
      return 'disabled';
    }
    // El validador que falló manda: el error es del formulario, no del dibujo.
    return this.error() || this.fieldError() || this.search.status() === 'error'
      ? 'error'
      : 'default';
  });

  /** El mensaje del validador reemplaza al hint, como en el Input. */
  protected readonly note = computed(() => this.fieldError() || this.hint());

  /** Abierto toma el borde de foco: el foco está en el campo. */
  protected readonly borderColor = computed(() =>
    fieldBorderColor(this.effectiveState(), this.isOpen()),
  );

  /** `pr-9`: el chevron va encima del campo y el texto no puede pasarle por debajo. */
  protected readonly fieldClasses = computed(() =>
    [
      FIELD_BASE_CLASSES,
      FIELD_HEIGHT_CLASSES[this.size()],
      FIELD_PADDING_CLASSES[this.size()],
      fieldSurfaceClasses(this.effectiveState()),
      'pr-9',
    ].join(' '),
  );

  protected readonly fontSize = computed(() => FIELD_FONT_SIZES[this.size()]);

  protected readonly describedBy = computed(() =>
    [
      this.statusId,
      this.note() ? this.hintId : null,
      this.search.status() === 'error' ? this.errorId : null,
    ]
      .filter((id) => id !== null)
      .join(' '),
  );

  /** Solo mientras existe el panel: un id fuera del documento es peor que ninguno. */
  protected readonly controlsId = computed(() => (this.isOpen() ? this.listboxId : null));

  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.isOpen() && index >= 0 ? this.optionId(index) : null;
  });

  protected optionId(index: number): string {
    return `${this.fieldId}-option-${index}`;
  }

  protected optionClasses(index: number): string {
    return selectOptionClasses(index === this.selectedIndex(), index === this.activeIndex());
  }

  /** RFE-08: la región viva anuncia el cambio de lista, porque el foco nunca se mueve. */
  protected readonly announcement = computed(() => this.search.announce(this.words()));

  private onSearchStart(request: SearchRequest): void {
    if (!request.append) {
      this.activeIndex.set(-1);
    }
    // RFE-01: se abre solo, salvo un escaneo, que intenta resolver sin panel.
    if (!request.scan) {
      this.open();
    }
  }

  private onSearchArrived(request: SearchRequest): void {
    if (!request.scan) {
      if (!request.append && this.selectedIndex() >= 0) {
        this.activeIndex.set(this.selectedIndex());
      }
      return;
    }
    // RFE-06: un único registro exacto (REQ §8: sin mayúsculas, nada más) se elige sin panel.
    const code = this.display()?.code;
    const only = this.rows().length === 1 ? this.rows()[0] : undefined;
    if (only !== undefined && code?.(only as T).toLowerCase() === request.query.toLowerCase()) {
      this.choose(only);
      return;
    }
    this.open();
  }

  private open(): void {
    if (this.isDisabled() || this.isOpen()) {
      return;
    }
    if (!this.overlayRef) {
      // Se arma una vez: suscribirse en cada apertura apilaría un listener por vez.
      this.overlayRef = createConnectedOverlay(
        this.injector,
        this.anchor().nativeElement,
        PANEL_POSITIONS,
      );
      this.overlayRef.outsidePointerEvents().subscribe(() => this.close());
    }
    // Ancho del campo leído al abrir, no guardado: cambia con el layout.
    this.overlayRef.updateSize({
      width: this.anchor().nativeElement.getBoundingClientRect().width,
    });
    this.overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);
  }

  /** Cierra sin tocar el valor; toda salida pasa por acá. */
  private close(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  protected onFieldClick(): void {
    if (!this.isOpen() && this.source() === null) {
      // Lista en memoria: abrir muestra todo, sin tener que escribir.
      this.search.find('');
    }
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    if (value === '' && this.source() !== null) {
      // RFE-03: vaciar la caja no busca ni borra el valor elegido.
      this.search.clear();
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
          this.moveActive(1);
        } else if (this.source() === null) {
          // Con 3 opciones: flecha abre, flecha elige, Enter confirma.
          this.search.find('');
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
          this.search.find(this.text(), true);
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
    }
  }

  /** Frena en los extremos (`listbox/`); «cargar más» cuenta como fila: las flechas lo alcanzan. */
  private moveActive(delta: number): void {
    const count = this.rows().length + (this.search.hasMore() ? 1 : 0);
    this.activeIndex.set(moveActiveIndex(this.activeIndex(), delta, count));
  }

  private activate(index: number): void {
    if (this.search.hasMore() && index === this.rows().length) {
      this.search.more();
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

  /** El foco se mueve en mousedown: prevenirlo lo deja en el campo. */
  protected onOptionMousedown(event: MouseEvent): void {
    event.preventDefault();
  }

  /** Repone la etiqueta del valor real: texto a medio tipear mentiría sobre él (RFE-03). */
  protected onBlur(): void {
    this.text.set(this.selectedLabel() ?? '');
    this.markTouched();
  }

  /** RFE-01: volver al campo reabre el panel si hay resultados, sin retipear. */
  protected onFocus(): void {
    if (this.source() !== null && this.text() && this.rows().length > 0) {
      this.open();
    }
  }
}
