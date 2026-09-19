import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  SEARCH_PAGE_SIZE,
  SearchSelect,
  type SearchDisplay,
  type SearchSelectMessages,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import {
  CATALOGUE,
  CatalogueSource,
  UncountedSource,
  type Article,
  type SourceBehaviour,
} from './search-catalogue';

const MATRIX_VARIANTS: readonly MatrixAxis[] = [
  { id: 'idle', label: 'Sin escribir' },
  { id: 'searching', label: 'Buscando' },
  { id: 'empty', label: 'Sin resultados' },
  { id: 'error', label: 'Error del servicio' },
  { id: 'more', label: 'Hay más páginas' },
];

const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'where', label: 'Dónde se ve' },
  { id: 'announce', label: 'Qué se anuncia' },
  { id: 'value', label: 'Qué pasa con el valor' },
];

/** The matrix is a table of facts, because these states cannot be held still. */
const STATE_FACTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
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

/** VERIFIED AGAINST search-select.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'source',
    type: 'SearchSource<T>',
    default: '— (requerido)',
    description:
      'De dónde salen los registros. Una interfaz, nunca un endpoint: el componente no conoce HTTP.',
  },
  {
    name: 'display',
    type: 'SearchDisplay<T>',
    default: '— (requerido)',
    description:
      'label(item) es lo que se lee; code(item) es opcional y sólo decide si un escaneo coincide exacto.',
  },
  {
    name: 'messages',
    type: 'SearchSelectMessages',
    default: '— (requerido)',
    description:
      'Los textos de los cuatro estados, ya traducidos. Sin default, porque un default sería un idioma.',
  },
  {
    name: 'value',
    type: 'T | null',
    default: 'null',
    description: 'El registro elegido. Siembra el control; después manda el formulario.',
  },
  {
    name: 'label',
    type: 'string',
    default: '— (requerido)',
    description: 'Visible y unido al campo con for/id: acá sí hay un <input>, que sí es etiquetable.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'La misma escala del Input, del Select y del Botón: 32 / 40 / 48.',
  },
  {
    name: 'placeholder',
    type: 'string',
    default: "''",
    description: 'Lo que muestra el campo vacío.',
  },
  {
    name: 'hint',
    type: 'string',
    default: "''",
    description: 'Ayuda bajo el campo. Se pone danger con error.',
  },
  {
    name: 'error',
    type: 'boolean',
    default: 'false',
    description:
      'Puramente visual, como el del Input. Un error del servicio también pinta el borde, sin que el consumidor haga nada.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Heredado de FormControlBase, combinado con el del formulario por OR.',
  },
];

const ANATOMY = [
  { part: 'Retardo entre la última tecla y la consulta', token: '--delay-search-input' },
  { part: 'Cuánto se tolera que tarde la fuente', token: '--timeout-search' },
  { part: 'Umbral de ráfaga de escáner, por tecla', token: '--threshold-scan-keystroke' },
  { part: 'Fondo del campo y del panel', token: '--color-surface' },
  { part: 'Borde default del campo', token: '--color-border-strong' },
  { part: 'Borde en foco y con el panel abierto', token: '--color-bg-primary' },
  { part: 'Borde con error del servicio', token: '--color-bg-danger' },
  { part: 'Fondo del bloque de error', token: '--color-danger-surface' },
  { part: 'Fondo de la fila activa', token: '--color-ghost-hover' },
  { part: 'Elevación del panel', token: '--shadow-md' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
] as const;

/**
 * /design-system/components/search-select -- the sheet of
 * `ewms-search-select`, and the deliverable of REQ-FE-DS3-001.
 *
 * THE PAGE LEADS WITH THE SCANNER, because that is the case the REQ was
 * written for: an operator with a gun in one hand, whose code has to resolve
 * without touching anything. Typing is the fallback, not the main path.
 */
@Component({
  selector: 'ewms-showroom-search-select',
  imports: [Button, SearchSelect, ReactiveFormsModule, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './search-select.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSearchSelect {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;
  protected readonly pageSize = SEARCH_PAGE_SIZE;
  protected readonly catalogueSize = CATALOGUE.length;

  /** How the demo source behaves, so the failure states can be seen. */
  protected readonly behaviour = signal<SourceBehaviour>('normal');

  /** Whether the source reports a total at all -- `null` is legitimate. */
  protected readonly counts = signal(true);

  /** Every query the source received, newest first. */
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

  protected readonly messages: SearchSelectMessages = {
    searching: 'Buscando…',
    noResults: (query) => `Sin resultados para «${query}»`,
    error: 'No se pudo consultar el catálogo.',
    retry: 'Reintentar',
    more: 'Ver más resultados',
    results: (count, total) =>
      total === null ? `${count} resultados` : `${count} de ${total} resultados`,
  };

  protected readonly form = new FormGroup({
    articulo: new FormControl<Article | null>(null),
  });

  protected readonly chosen = toSignal(this.form.controls.articulo.valueChanges, {
    initialValue: this.form.controls.articulo.value,
  });

  /** A real code from the synthetic catalogue, for the scan instructions. */
  protected readonly sampleCode = CATALOGUE[42]?.code ?? '';

  protected readonly snippet = [
    '<ewms-search-select',
    '  formControlName="articulo"',
    '  [source]="catalogo"',
    '  [display]="{ label: a => a.codigo, code: a => a.codigo }"',
    '  [messages]="mensajes()"',
    "  [label]=\"'recepciones.articulo' | transloco\"",
    "  [placeholder]=\"'recepciones.escaneaOEscribi' | transloco\"",
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

  protected readonly chosenLabel = computed(() => {
    const article = this.chosen();
    return article ? `${article.code} · ${article.name}` : '(ninguno)';
  });

  protected fact(variantId: string, stateId: string): string {
    return STATE_FACTS[variantId]?.[stateId] ?? '';
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
