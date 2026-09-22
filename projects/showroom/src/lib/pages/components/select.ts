import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  SEARCH_PAGE_SIZE,
  Select,
  type FieldSize,
  type SearchDisplay,
  type SelectOption,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { formatBox, formatHeight, rectOf, widthOf } from './measure';
import {
  CATALOGUE,
  CatalogueSource,
  UncountedSource,
  type Article,
  type SourceBehaviour,
} from './search-catalogue';

/**
 * Solo estados reales del campo cerrado. Sin Focus ni Open, por lo mismo que en
 * Input (borde en línea atado a una señal); además el panel abierto vive en un
 * overlay del CDK fuera de la tabla.
 */
const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'selected', label: 'Con selección' },
  { id: 'error', label: 'Error' },
  { id: 'disabled', label: 'Disabled' },
];

const SIZES: readonly MatrixAxis[] = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Medium' },
  { id: 'lg', label: 'Large' },
];

const SIZE_BY_ID: Readonly<Record<string, FieldSize>> = { sm: 'sm', md: 'md', lg: 'lg' };

/** Tamaño único del chevron en píxeles CSS: sm en todos los tamaños de campo. */
const CHEVRON_SIZE = 16;

const OPTIONS: readonly SelectOption[] = [
  { value: 'central', label: 'Almacén central' },
  { value: 'muelle-3', label: 'Muelle 3' },
  { value: 'cuarentena', label: 'Cuarentena' },
  { value: 'devoluciones', label: 'Devoluciones' },
  { value: 'transito', label: 'En tránsito' },
];

/** La lista corta de la demo: con tres opciones se elige igual de rápido con teclado. */
const STATES_3: readonly SelectOption[] = [
  { value: 'abierta', label: 'Abierta' },
  { value: 'preparacion', label: 'En preparación' },
  { value: 'despachada', label: 'Despachada' },
];

/** Veinticuatro: la lista larga filtra en memoria, sin fuente. */
const LOCATIONS: readonly SelectOption[] = Array.from({ length: 24 }, (_unused, index) => {
  const aisle = String.fromCharCode(65 + Math.floor(index / 6));
  const rack = String((index % 6) + 1).padStart(2, '0');
  return { value: `${aisle}-${rack}`, label: `Pasillo ${aisle}, rack ${rack}` };
});

/** Los estados de la búsqueda no se pueden congelar: la matriz es una tabla de hechos. */
const SEARCH_VARIANTS: readonly MatrixAxis[] = [
  { id: 'idle', label: 'Sin escribir' },
  { id: 'searching', label: 'Buscando' },
  { id: 'empty', label: 'Sin resultados' },
  { id: 'error', label: 'Error del servicio' },
  { id: 'more', label: 'Hay más páginas' },
];

const SEARCH_COLUMNS: readonly MatrixAxis[] = [
  { id: 'where', label: 'Dónde se ve' },
  { id: 'announce', label: 'Qué se anuncia' },
  { id: 'value', label: 'Qué pasa con el valor' },
];

const SEARCH_FACTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  idle: {
    where: 'Nada. El panel no está en el documento.',
    announce: 'Nada: la región viva está vacía.',
    value: 'Intacto.',
  },
  searching: {
    where: 'Fila con spinner al final del panel.',
    announce: '«Buscando…»',
    value: 'Intacto.',
  },
  empty: {
    where: 'Fila en el panel, repitiendo el texto buscado.',
    announce: '«Sin resultados para «X»»',
    value: 'Intacto. Un texto sin coincidencias no borra lo elegido.',
  },
  error: {
    where: 'Bloque bajo el campo, en el flujo, con botón de reintento.',
    announce: '«No se pudo consultar el catálogo»',
    value: 'Intacto, y el texto escrito tampoco se pierde.',
  },
  more: {
    where: 'Última fila del panel, alcanzable con las flechas.',
    announce: '«N de M» — o «N resultados» si la fuente no cuenta.',
    value: 'Intacto hasta que se elige una fila.',
  },
};

/** Verificada contra select.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: '— (requerido)',
    description: 'Visible, unida al campo por for/id.',
  },
  {
    name: 'options',
    type: 'readonly SelectOption[] | readonly T[]',
    default: 'null',
    description: 'Lista cerrada en memoria: abre entera y filtra al escribir, sin espera.',
  },
  {
    name: 'source',
    type: 'SearchSource<T>',
    default: 'null',
    description: 'Fuente del backend, paginada. Excluye a options: los dos juntos son un error.',
  },
  {
    name: 'display',
    type: 'SearchDisplay<T>',
    default: 'null',
    description: 'label(item) y code(item). Con display el valor es el registro entero.',
  },
  {
    name: 'value',
    type: 'unknown',
    default: 'null',
    description: 'El valor elegido. Siembra el control; después manda el formulario.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'La misma escala del Input y del Botón: 32 / 40 / 48.',
  },
  {
    name: 'placeholder · hint',
    type: 'string',
    default: "''",
    description: 'Ya traducidos. El hint va por aria-describedby y se pone danger con error.',
  },
  {
    name: 'error · disabled',
    type: 'boolean',
    default: 'false',
    description: 'Visual el primero; disabled se suma por OR al del formulario.',
  },
  {
    name: 'messages',
    type: 'Partial<SelectMessages>',
    default: 'null',
    description: 'Pisa en una instancia los textos de EWMS_SELECT_MESSAGES, que se proveen una vez.',
  },
];

const ANATOMY = [
  { part: 'Fondo del campo y del panel', token: '--color-surface' },
  { part: 'Borde default', token: '--color-border-strong' },
  { part: 'Borde en foco y con el panel abierto', token: '--color-bg-primary' },
  { part: 'Borde en error, también el del servicio', token: '--color-bg-danger' },
  { part: 'Fondo del bloque de error del servicio', token: '--color-danger-surface' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
  { part: 'Fondo deshabilitado', token: '--color-bg-secondary' },
  { part: 'Placeholder, chevron y hint', token: '--color-text-secondary' },
  { part: 'Fondo de la opción activa y del hover', token: '--color-ghost-hover' },
  { part: 'Radio del campo y del panel', token: '--radius-control' },
  { part: 'Elevación del panel', token: '--shadow-md' },
  { part: 'Peso de la opción seleccionada', token: '--text-control-selected-weight' },
  { part: 'Chevron y check, los tres tamaños', token: '--size-icon-sm' },
  { part: 'Retardo entre la última tecla y la consulta', token: '--delay-search-input' },
  { part: 'Cuánto se tolera que tarde la fuente', token: '--timeout-search' },
  { part: 'Umbral de ráfaga de escáner, por tecla', token: '--threshold-scan-keystroke' },
] as const;

interface ChevronSample {
  readonly size: FieldSize;
  readonly label: string;
  readonly trigger: string;
  readonly chevron: string;
  readonly sameChevron: boolean;
}

/**
 * /design-system/components/select: el único selector, y siempre busca (decisión del usuario,
 * 2026-09-22). Tres demos sobre el mismo campo: lista corta, lista larga y fuente remota.
 */
@Component({
  selector: 'ewms-showroom-select',
  imports: [Button, ReactiveFormsModule, Select, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './select.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSelect {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly states3 = STATES_3;
  protected readonly states = STATES;
  protected readonly sizes = SIZES;
  protected readonly options = OPTIONS;
  protected readonly locations = LOCATIONS;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly searchVariants = SEARCH_VARIANTS;
  protected readonly searchColumns = SEARCH_COLUMNS;
  protected readonly pageSize = SEARCH_PAGE_SIZE;
  protected readonly catalogueSize = CATALOGUE.length;

  protected readonly form = new FormGroup({
    estado: new FormControl<unknown>('preparacion'),
    rack: new FormControl<unknown>(null),
    articulo: new FormControl<Article | null>(null),
  });

  protected readonly chosen = toSignal(this.form.controls.estado.valueChanges, {
    initialValue: this.form.controls.estado.value,
  });

  protected readonly rack = toSignal(this.form.controls.rack.valueChanges, {
    initialValue: this.form.controls.rack.value,
  });

  protected readonly article = toSignal(this.form.controls.articulo.valueChanges, {
    initialValue: this.form.controls.articulo.value,
  });

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

  protected readonly chevrons = signal<readonly ChevronSample[]>([
    { size: 'sm', label: 'Small', trigger: '…', chevron: '…', sameChevron: false },
    { size: 'md', label: 'Medium', trigger: '…', chevron: '…', sameChevron: false },
    { size: 'lg', label: 'Large', trigger: '…', chevron: '…', sameChevron: false },
  ]);

  protected readonly snippet = [
    '<!-- Lista cerrada en memoria: abre entera y filtra al escribir -->',
    '<ewms-select',
    '  formControlName="estado"',
    "  [label]=\"'recepciones.estado' | transloco\"",
    '  [options]="estados()"',
    '/>',
    '',
    '<!-- Fuente del backend: busca, pagina y resuelve un escaneo -->',
    '<ewms-select',
    '  formControlName="articulo"',
    '  [source]="catalogo"',
    '  [display]="{ label: a => a.codigo, code: a => a.codigo }"',
    "  [label]=\"'recepciones.articulo' | transloco\"",
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

  /** Etiqueta de la opción que tiene el formulario, para la lectura en vivo. */
  protected chosenLabel(): string {
    const value = this.chosen();
    return STATES_3.find((option) => option.value === value)?.label ?? '(sin elegir)';
  }

  protected readonly articleLabel = computed(() => {
    const article = this.article();
    return article ? `${article.code} · ${article.name}` : '(ninguno)';
  });

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
    this.queries.update((current) => [`«${query}» · página ${page}`, ...current].slice(0, 6));
  }
}
