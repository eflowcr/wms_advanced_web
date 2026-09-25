import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { form as signalForm, FormField } from '@angular/forms/signals';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  SEARCH_PAGE_SIZE,
  Select,
  type FieldSize,
  type SearchDisplay,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { translated } from '../../ui/translated';
import { formatBox, formatHeight, rectOf, widthOf } from './measure';
import {
  CATALOGUE,
  CatalogueSource,
  UncountedSource,
  type Article,
  type SourceBehaviour,
} from './search-catalogue';
import { LOCATION_OPTIONS, RACK_OPTIONS } from './select.fixtures';

/**
 * Solo estados reales del campo cerrado. Sin Focus ni Open, por lo mismo que en
 * Input (borde en línea atado a una señal); además el panel abierto vive en un
 * overlay del CDK fuera de la tabla.
 * t(showroom.common.states.default, showroom.select.states.withSelection,
 *   showroom.common.states.error, showroom.common.states.disabled)
 */
const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'showroom.common.states.default' },
  { id: 'selected', label: 'showroom.select.states.withSelection' },
  { id: 'error', label: 'showroom.common.states.error' },
  { id: 'disabled', label: 'showroom.common.states.disabled' },
];

/** t(showroom.common.sizes.sm, showroom.common.sizes.md, showroom.common.sizes.lg) */
const SIZES: readonly MatrixAxis[] = [
  { id: 'sm', label: 'showroom.common.sizes.sm' },
  { id: 'md', label: 'showroom.common.sizes.md' },
  { id: 'lg', label: 'showroom.common.sizes.lg' },
];

const SIZE_BY_ID: Readonly<Record<string, FieldSize>> = { sm: 'sm', md: 'md', lg: 'lg' };

/** Tamaño único del chevron en píxeles CSS: sm en todos los tamaños de campo. */
const CHEVRON_SIZE = 16;

/**
 * Los estados de la búsqueda no se pueden congelar: la matriz es una tabla de hechos.
 * t(showroom.select.searchStates.rows.idle, showroom.select.searchStates.rows.searching,
 *   showroom.select.searchStates.rows.empty, showroom.select.searchStates.rows.error,
 *   showroom.select.searchStates.rows.more)
 */
const SEARCH_VARIANTS: readonly MatrixAxis[] = [
  { id: 'idle', label: 'showroom.select.searchStates.rows.idle' },
  { id: 'searching', label: 'showroom.select.searchStates.rows.searching' },
  { id: 'empty', label: 'showroom.select.searchStates.rows.empty' },
  { id: 'error', label: 'showroom.select.searchStates.rows.error' },
  { id: 'more', label: 'showroom.select.searchStates.rows.more' },
];

/**
 * t(showroom.select.searchStates.columns.where, showroom.select.searchStates.columns.announce,
 *   showroom.select.searchStates.columns.value)
 */
const SEARCH_COLUMNS: readonly MatrixAxis[] = [
  { id: 'where', label: 'showroom.select.searchStates.columns.where' },
  { id: 'announce', label: 'showroom.select.searchStates.columns.announce' },
  { id: 'value', label: 'showroom.select.searchStates.columns.value' },
];

/**
 * La clave de cada hecho, por fila y columna.
 * t(showroom.select.searchStates.facts.idle.where, showroom.select.searchStates.facts.idle.announce,
 *   showroom.select.searchStates.facts.idle.value,
 *   showroom.select.searchStates.facts.searching.where,
 *   showroom.select.searchStates.facts.searching.announce,
 *   showroom.select.searchStates.facts.searching.value,
 *   showroom.select.searchStates.facts.empty.where,
 *   showroom.select.searchStates.facts.empty.announce,
 *   showroom.select.searchStates.facts.empty.value,
 *   showroom.select.searchStates.facts.error.where,
 *   showroom.select.searchStates.facts.error.announce,
 *   showroom.select.searchStates.facts.error.value,
 *   showroom.select.searchStates.facts.more.where, showroom.select.searchStates.facts.more.announce,
 *   showroom.select.searchStates.facts.more.value)
 */
const SEARCH_FACTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  idle: {
    where: 'showroom.select.searchStates.facts.idle.where',
    announce: 'showroom.select.searchStates.facts.idle.announce',
    value: 'showroom.select.searchStates.facts.idle.value',
  },
  searching: {
    where: 'showroom.select.searchStates.facts.searching.where',
    announce: 'showroom.select.searchStates.facts.searching.announce',
    value: 'showroom.select.searchStates.facts.searching.value',
  },
  empty: {
    where: 'showroom.select.searchStates.facts.empty.where',
    announce: 'showroom.select.searchStates.facts.empty.announce',
    value: 'showroom.select.searchStates.facts.empty.value',
  },
  error: {
    where: 'showroom.select.searchStates.facts.error.where',
    announce: 'showroom.select.searchStates.facts.error.announce',
    value: 'showroom.select.searchStates.facts.error.value',
  },
  more: {
    where: 'showroom.select.searchStates.facts.more.where',
    announce: 'showroom.select.searchStates.facts.more.announce',
    value: 'showroom.select.searchStates.facts.more.value',
  },
};

/**
 * Verificada contra select.ts.
 * t(showroom.select.props.label, showroom.select.props.hideLabel, showroom.select.props.options,
 *   showroom.select.props.source, showroom.select.props.display, showroom.select.props.value,
 *   showroom.select.props.size, showroom.select.props.placeholderHint,
 *   showroom.select.props.errorDisabled, showroom.select.props.messages)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: '—',
    description: 'showroom.select.props.label',
  },
  {
    name: 'hideLabel',
    type: 'boolean',
    default: 'false',
    description: 'showroom.select.props.hideLabel',
  },
  {
    name: 'options',
    type: 'readonly SelectOption[] | readonly T[]',
    default: 'null',
    description: 'showroom.select.props.options',
  },
  {
    name: 'source',
    type: 'SearchSource<T>',
    default: 'null',
    description: 'showroom.select.props.source',
  },
  {
    name: 'display',
    type: 'SearchDisplay<T>',
    default: 'null',
    description: 'showroom.select.props.display',
  },
  {
    name: 'value',
    type: 'unknown',
    default: 'null',
    description: 'showroom.select.props.value',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'showroom.select.props.size',
  },
  {
    name: 'placeholder · hint',
    type: 'string',
    default: "''",
    description: 'showroom.select.props.placeholderHint',
  },
  {
    name: 'error · disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.select.props.errorDisabled',
  },
  {
    name: 'messages',
    type: 'Partial<SelectMessages>',
    default: 'null',
    description: 'showroom.select.props.messages',
  },
];

/**
 * t(showroom.select.anatomy.parts.background, showroom.select.anatomy.parts.borderDefault,
 *   showroom.select.anatomy.parts.borderFocus, showroom.select.anatomy.parts.borderError,
 *   showroom.select.anatomy.parts.errorBlock, showroom.select.anatomy.parts.focusRing,
 *   showroom.select.anatomy.parts.disabled, showroom.select.anatomy.parts.secondaryText,
 *   showroom.select.anatomy.parts.activeOption, showroom.select.anatomy.parts.radius,
 *   showroom.select.anatomy.parts.elevation, showroom.select.anatomy.parts.selectedWeight,
 *   showroom.select.anatomy.parts.iconSize, showroom.select.anatomy.parts.inputDelay,
 *   showroom.select.anatomy.parts.timeout, showroom.select.anatomy.parts.scanThreshold)
 */
const ANATOMY = [
  { part: 'showroom.select.anatomy.parts.background', token: '--color-surface' },
  { part: 'showroom.select.anatomy.parts.borderDefault', token: '--color-border-strong' },
  { part: 'showroom.select.anatomy.parts.borderFocus', token: '--color-bg-primary' },
  { part: 'showroom.select.anatomy.parts.borderError', token: '--color-bg-danger' },
  { part: 'showroom.select.anatomy.parts.errorBlock', token: '--color-danger-surface' },
  { part: 'showroom.select.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
  { part: 'showroom.select.anatomy.parts.disabled', token: '--color-bg-secondary' },
  { part: 'showroom.select.anatomy.parts.secondaryText', token: '--color-text-secondary' },
  { part: 'showroom.select.anatomy.parts.activeOption', token: '--color-ghost-hover' },
  { part: 'showroom.select.anatomy.parts.radius', token: '--radius-control' },
  { part: 'showroom.select.anatomy.parts.elevation', token: '--shadow-md' },
  {
    part: 'showroom.select.anatomy.parts.selectedWeight',
    token: '--text-control-selected-weight',
  },
  { part: 'showroom.select.anatomy.parts.iconSize', token: '--size-icon-sm' },
  { part: 'showroom.select.anatomy.parts.inputDelay', token: '--delay-search-input' },
  { part: 'showroom.select.anatomy.parts.timeout', token: '--timeout-search' },
  { part: 'showroom.select.anatomy.parts.scanThreshold', token: '--threshold-scan-keystroke' },
] as const;

/**
 * t(showroom.select.keyboard.columns.key, showroom.select.keyboard.columns.closed,
 *   showroom.select.keyboard.columns.open)
 */
const KEYBOARD_COLUMNS: readonly DocColumn[] = [
  { id: 'key', label: 'showroom.select.keyboard.columns.key' },
  { id: 'closed', label: 'showroom.select.keyboard.columns.closed' },
  { id: 'open', label: 'showroom.select.keyboard.columns.open' },
];

/**
 * El contrato de teclado, una fila por tecla; la plantilla arma la clave con el id y la columna.
 * t(showroom.select.keyboard.arrows.key, showroom.select.keyboard.arrows.closed,
 *   showroom.select.keyboard.arrows.open, showroom.select.keyboard.enter.key,
 *   showroom.select.keyboard.enter.closed, showroom.select.keyboard.enter.open,
 *   showroom.select.keyboard.escape.key, showroom.select.keyboard.escape.closed,
 *   showroom.select.keyboard.escape.open, showroom.select.keyboard.letters.key,
 *   showroom.select.keyboard.letters.closed, showroom.select.keyboard.letters.open,
 *   showroom.select.keyboard.tab.key, showroom.select.keyboard.tab.closed,
 *   showroom.select.keyboard.tab.open)
 */
const KEYBOARD_ROWS = ['arrows', 'enter', 'escape', 'letters', 'tab'] as const;

/**
 * Clave del scope del catálogo para cada consulta registrada. Constante y marcador, no el literal
 * en translate(): el extractor lo daría por clave del diccionario raíz.
 * t(showroom.select.demo.queries.entry)
 */
const QUERY_ENTRY = 'showroom.select.demo.queries.entry';

interface ChevronSample {
  readonly size: FieldSize;
  /** Clave del nombre del tamaño. */
  readonly label: string;
  readonly trigger: string;
  readonly chevron: string;
  readonly sameChevron: boolean;
}

/**
 * /design-system/components/select: el único selector, y siempre busca (decisión del usuario,
 * 2026-09-22). Tres demos sobre el mismo campo: lista corta, lista larga y fuente remota.
 */
/** t(showroom.select.states.rowHeader) */
const STATES_ROW_HEADER = 'showroom.select.states.rowHeader';

@Component({
  selector: 'ewms-showroom-select',
  imports: [
    Button,
    FormField,
    Select,
    DemoFrame,
    DocTable,
    PropTable,
    Prose,
    StateMatrix,
    TokenValue,
    TranslocoPipe,
  ],
  templateUrl: './select.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSelect {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly transloco = inject(TranslocoService);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly statesRowHeader = STATES_ROW_HEADER;
  protected readonly states = STATES;
  protected readonly sizes = SIZES;
  protected readonly options = LOCATION_OPTIONS;
  protected readonly locations = RACK_OPTIONS;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;
  protected readonly searchVariants = SEARCH_VARIANTS;
  protected readonly searchColumns = SEARCH_COLUMNS;
  protected readonly keyboardColumns = KEYBOARD_COLUMNS;
  protected readonly keyboardRows = KEYBOARD_ROWS;
  protected readonly pageSize = SEARCH_PAGE_SIZE;
  protected readonly catalogueSize = CATALOGUE.length;

  /**
   * La lista corta de la demo: con tres opciones se elige igual de rápido con teclado. Son nombres
   * de estado, que la interfaz traduce; siguen al idioma.
   * t(showroom.select.demo.short.options.open, showroom.select.demo.short.options.preparing,
   *   showroom.select.demo.short.options.dispatched)
   */
  protected readonly states3 = translated((t) => [
    { value: 'abierta', label: t('showroom.select.demo.short.options.open') },
    { value: 'preparacion', label: t('showroom.select.demo.short.options.preparing') },
    { value: 'despachada', label: t('showroom.select.demo.short.options.dispatched') },
  ]);

  protected readonly model = signal<{
    estado: string | null;
    rack: string | null;
    articulo: Article | null;
  }>({ estado: 'preparacion', rack: null, articulo: null });

  protected readonly form = signalForm(this.model);

  protected readonly chosen = computed(() => this.form.estado().value());

  protected readonly rack = computed(() => this.form.rack().value());

  protected readonly article = computed(() => this.form.articulo().value());

  /** Comportamiento de la fuente, para ver los estados de falla. */
  protected readonly behaviour = signal<SourceBehaviour>('normal');

  /** Si la fuente informa total; null es válido. */
  protected readonly counts = signal(true);

  /** Consultas recibidas por la fuente, la más nueva primero. */
  protected readonly queries = signal<readonly string[]>([]);

  private readonly counted = new CatalogueSource(
    () => this.behaviour(),
    (query, page) => this.recordQuery(query, page),
  );

  private readonly uncounted = new UncountedSource(this.counted);

  protected readonly source = computed(() => (this.counts() ? this.counted : this.uncounted));

  protected readonly display: SearchDisplay<Article> = {
    label: (article) => `${article.code} · ${article.name}`,
    code: (article) => article.code,
  };

  /** Código existente del catálogo sintético, para las instrucciones de escaneo. */
  protected readonly sampleCode = CATALOGUE[42]?.code ?? '';

  /** t(showroom.common.sizes.sm, showroom.common.sizes.md, showroom.common.sizes.lg) */
  protected readonly chevrons = signal<readonly ChevronSample[]>([
    {
      size: 'sm',
      label: 'showroom.common.sizes.sm',
      trigger: '…',
      chevron: '…',
      sameChevron: false,
    },
    {
      size: 'md',
      label: 'showroom.common.sizes.md',
      trigger: '…',
      chevron: '…',
      sameChevron: false,
    },
    {
      size: 'lg',
      label: 'showroom.common.sizes.lg',
      trigger: '…',
      chevron: '…',
      sameChevron: false,
    },
  ]);

  protected readonly snippet = [
    '<!-- Lista cerrada en memoria: abre entera y filtra al escribir -->',
    '<ewms-select',
    '  [formField]="alta.estado"',
    '  [label]="\'recepciones.estado\' | transloco"',
    '  [options]="estados()"',
    '/>',
    '',
    '<!-- Fuente del backend: busca, pagina y resuelve un escaneo -->',
    '<ewms-select',
    '  [formField]="alta.articulo"',
    '  [source]="catalogo"',
    '  [display]="{ label: a => a.codigo, code: a => a.codigo }"',
    '  [label]="\'recepciones.articulo\' | transloco"',
    '/>',
  ].join('\n');

  protected readonly sourceSnippet = [
    'export class CatalogoHttpSource implements SearchSource<Articulo> {',
    '  private readonly http = inject(ArticulosApi);',
    '',
    '  search(query: string, page: number): Observable<SearchPage<Articulo>> {',
    '    return this.http.buscar({ q: query, page, pageSize: 20 });',
    '  }',
    '}',
  ].join('\n');

  constructor() {
    // El chevron mide 16 px en los tres tamaños; alguien querrá «arreglarlo» a
    // 14 / 16 / 18. Se mide el SVG en los tres y se compara.
    afterNextRender(() => {
      this.chevrons.update((samples) =>
        samples.map((sample) => {
          const root = this.host.nativeElement;
          const selector = `[data-chevron-sample="${sample.size}"]`;
          const trigger = rectOf(root, `${selector} input`);
          const chevron = rectOf(root, `${selector} svg`);
          return {
            ...sample,
            trigger: formatHeight(trigger),
            chevron: formatBox(chevron),
            sameChevron: widthOf(chevron) === CHEVRON_SIZE,
          };
        }),
      );
    });
  }

  protected sizeFor(id: string): FieldSize {
    return SIZE_BY_ID[id] ?? 'md';
  }

  /** Solo la fila «Con selección» arranca con valor. */
  protected valueFor(id: string): unknown {
    return id === 'selected' ? 'muelle-3' : null;
  }

  protected isError(id: string): boolean {
    return id === 'error';
  }

  protected isDisabled(id: string): boolean {
    return id === 'disabled';
  }

  /**
   * Etiqueta de la opción que tiene el formulario, para la lectura en vivo; null si ninguna
   * opción lleva ese valor (la plantilla dice «sin elegir»).
   */
  protected chosenLabel(): string | null {
    const value = this.chosen();
    return this.states3().find((option) => option.value === value)?.label ?? null;
  }

  /** El registro elegido como se lee; null si no hay (la plantilla dice «ninguno»). */
  protected readonly articleLabel = computed(() => {
    const article = this.article();
    return article ? `${article.code} · ${article.name}` : null;
  });

  /** Clave del hecho de una celda de la matriz de la búsqueda; vacía si la celda no existe. */
  protected fact(variantId: string, columnId: string): string {
    return SEARCH_FACTS[variantId]?.[columnId] ?? '';
  }

  protected setBehaviour(behaviour: SourceBehaviour): void {
    this.behaviour.set(behaviour);
  }

  protected toggleCounts(): void {
    this.counts.update((value) => !value);
  }

  protected clearQueries(): void {
    this.queries.set([]);
  }

  private recordQuery(query: string, page: number): void {
    const entry = this.transloco.translate(QUERY_ENTRY, { query, page });
    this.queries.update((current) => [entry, ...current].slice(0, 6));
  }
}
