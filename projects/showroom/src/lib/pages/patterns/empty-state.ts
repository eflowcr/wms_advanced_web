import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  DESIGN_SYSTEM_VERSION,
  EmptyState,
  type EmptyStateAction,
  type EmptyStateKind,
} from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { translated } from '../../ui/translated';

/**
 * Los cuatro `kind` tal como se escriben en una plantilla: son código, no texto de persona, y
 * viven en una sola constante de fragmentos para que nada los confunda con prosa.
 */
const KIND_SNIPPETS = {
  noData: 'no-data',
  noResults: 'no-results',
  error: 'error',
  noAccess: 'no-access',
} as const satisfies Readonly<Record<string, EmptyStateKind>>;

/**
 * Verificada contra empty-state.ts.
 * t(showroom.patternEmpty.props.kind, showroom.patternEmpty.props.title,
 *   showroom.patternEmpty.props.description, showroom.patternEmpty.props.action,
 *   showroom.patternEmpty.props.size, showroom.patternEmpty.props.icon)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'kind',
    type: Object.values(KIND_SNIPPETS)
      .map((kind) => `'${kind}'`)
      .join(' | '),
    default: `'${KIND_SNIPPETS.noData}'`,
    description: 'showroom.patternEmpty.props.kind',
  },
  {
    name: 'title',
    type: 'string',
    default: '—',
    description: 'showroom.patternEmpty.props.title',
  },
  {
    name: 'description',
    type: 'string',
    default: "''",
    description: 'showroom.patternEmpty.props.description',
  },
  {
    name: 'action',
    type: 'EmptyStateAction | null',
    default: 'null',
    description: 'showroom.patternEmpty.props.action',
  },
  {
    name: 'size',
    type: "'compact' | 'page'",
    default: "'page'",
    description: 'showroom.patternEmpty.props.size',
  },
  {
    name: 'icon',
    type: 'IconName | null',
    default: 'null',
    description: 'showroom.patternEmpty.props.icon',
  },
];

/**
 * Un caso. Todo lo que no es `kind` es una clave del diccionario; `name` es el `kind` como lo
 * muestra la matriz, que traduce sus ejes.
 */
interface Case {
  readonly kind: EmptyStateKind;
  readonly name: string;
  readonly when: string;
  readonly icon: string;
  readonly action: string;
  readonly title: string;
  readonly description: string;
}

/**
 * t(showroom.patternEmpty.matrix.kinds.noData, showroom.patternEmpty.matrix.kinds.noResults,
 *   showroom.patternEmpty.matrix.kinds.error, showroom.patternEmpty.matrix.kinds.noAccess,
 *   showroom.patternEmpty.cases.noData.when, showroom.patternEmpty.cases.noData.icon,
 *   showroom.patternEmpty.cases.noData.action, showroom.patternEmpty.cases.noData.title,
 *   showroom.patternEmpty.cases.noData.description, showroom.patternEmpty.cases.noResults.when,
 *   showroom.patternEmpty.cases.noResults.icon, showroom.patternEmpty.cases.noResults.action,
 *   showroom.patternEmpty.cases.noResults.title, showroom.patternEmpty.cases.noResults.description,
 *   showroom.patternEmpty.cases.error.when, showroom.patternEmpty.cases.error.icon,
 *   showroom.patternEmpty.cases.error.action, showroom.patternEmpty.cases.error.title,
 *   showroom.patternEmpty.cases.error.description, showroom.patternEmpty.cases.noAccess.when,
 *   showroom.patternEmpty.cases.noAccess.icon, showroom.patternEmpty.cases.noAccess.action,
 *   showroom.patternEmpty.cases.noAccess.title, showroom.patternEmpty.cases.noAccess.description)
 */
const CASES: readonly Case[] = [
  {
    kind: KIND_SNIPPETS.noData,
    name: 'showroom.patternEmpty.matrix.kinds.noData',
    when: 'showroom.patternEmpty.cases.noData.when',
    icon: 'showroom.patternEmpty.cases.noData.icon',
    action: 'showroom.patternEmpty.cases.noData.action',
    title: 'showroom.patternEmpty.cases.noData.title',
    description: 'showroom.patternEmpty.cases.noData.description',
  },
  {
    kind: KIND_SNIPPETS.noResults,
    name: 'showroom.patternEmpty.matrix.kinds.noResults',
    when: 'showroom.patternEmpty.cases.noResults.when',
    icon: 'showroom.patternEmpty.cases.noResults.icon',
    action: 'showroom.patternEmpty.cases.noResults.action',
    title: 'showroom.patternEmpty.cases.noResults.title',
    description: 'showroom.patternEmpty.cases.noResults.description',
  },
  {
    kind: KIND_SNIPPETS.error,
    name: 'showroom.patternEmpty.matrix.kinds.error',
    when: 'showroom.patternEmpty.cases.error.when',
    icon: 'showroom.patternEmpty.cases.error.icon',
    action: 'showroom.patternEmpty.cases.error.action',
    title: 'showroom.patternEmpty.cases.error.title',
    description: 'showroom.patternEmpty.cases.error.description',
  },
  {
    kind: KIND_SNIPPETS.noAccess,
    name: 'showroom.patternEmpty.matrix.kinds.noAccess',
    when: 'showroom.patternEmpty.cases.noAccess.when',
    icon: 'showroom.patternEmpty.cases.noAccess.icon',
    action: 'showroom.patternEmpty.cases.noAccess.action',
    title: 'showroom.patternEmpty.cases.noAccess.title',
    description: 'showroom.patternEmpty.cases.noAccess.description',
  },
];

/**
 * t(showroom.patternEmpty.variants.columns.kind, showroom.patternEmpty.variants.columns.when,
 *   showroom.patternEmpty.variants.columns.icon, showroom.patternEmpty.variants.columns.action)
 */
const CASE_COLUMNS: readonly DocColumn[] = [
  { id: 'kind', label: 'showroom.patternEmpty.variants.columns.kind' },
  { id: 'when', label: 'showroom.patternEmpty.variants.columns.when' },
  { id: 'icon', label: 'showroom.patternEmpty.variants.columns.icon' },
  { id: 'action', label: 'showroom.patternEmpty.variants.columns.action' },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = CASES.map((item) => ({
  id: item.kind,
  label: item.name,
}));

/** t(showroom.patternEmpty.matrix.sizes.compact, showroom.patternEmpty.matrix.sizes.page) */
const MATRIX_SIZES: readonly MatrixAxis[] = [
  { id: 'compact', label: 'showroom.patternEmpty.matrix.sizes.compact' },
  { id: 'page', label: 'showroom.patternEmpty.matrix.sizes.page' },
];

/** El encabezado de la columna de filas de la matriz. t(showroom.patternEmpty.matrix.case) */
const MATRIX_ROW_HEADER = 'showroom.patternEmpty.matrix.case';

/**
 * t(showroom.patternEmpty.anatomy.parts.titleCompact, showroom.patternEmpty.anatomy.parts.titlePage,
 *   showroom.patternEmpty.anatomy.parts.secondaryText, showroom.patternEmpty.anatomy.parts.iconCircle,
 *   showroom.patternEmpty.anatomy.parts.iconCircleError, showroom.patternEmpty.anatomy.parts.iconSize)
 */
const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'showroom.patternEmpty.anatomy.parts.titleCompact', token: '--text-h4-size' },
  { part: 'showroom.patternEmpty.anatomy.parts.titlePage', token: '--text-h3-size' },
  { part: 'showroom.patternEmpty.anatomy.parts.secondaryText', token: '--color-text-secondary' },
  { part: 'showroom.patternEmpty.anatomy.parts.iconCircle', token: '--color-bg-secondary' },
  { part: 'showroom.patternEmpty.anatomy.parts.iconCircleError', token: '--color-danger-surface' },
  { part: 'showroom.patternEmpty.anatomy.parts.iconSize', token: '--size-icon-lg' },
];

/**
 * Lo que se muestra en «Última acción»: claves, traducidas en la plantilla. Limpiar filtros y
 * Reintentar dicen lo mismo que su botón.
 * t(showroom.patternEmpty.demo.nothingYet, showroom.patternEmpty.demo.created,
 *   showroom.patternEmpty.actions.clear, showroom.patternEmpty.actions.retry)
 */
const RAN = {
  nothing: 'showroom.patternEmpty.demo.nothingYet',
  create: 'showroom.patternEmpty.demo.created',
  clear: 'showroom.patternEmpty.actions.clear',
  retry: 'showroom.patternEmpty.actions.retry',
} as const;

/**
 * /design-system/patterns/empty-state: el estado vacío único, con sus cuatro casos. La tabla y el
 * select lo usan solos; una pantalla lo pone con una línea.
 */
@Component({
  selector: 'ewms-showroom-empty-state',
  templateUrl: './empty-state.html',
  imports: [
    EmptyState,
    DemoFrame,
    DocTable,
    PropTable,
    Prose,
    StateMatrix,
    TokenValue,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomEmptyState {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly cases = CASES;
  protected readonly caseColumns = CASE_COLUMNS;
  protected readonly anatomy = ANATOMY;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixSizes = MATRIX_SIZES;
  protected readonly matrixRowHeader = MATRIX_ROW_HEADER;

  /** Lo último que se pidió desde una acción, para ver que cada una dispara. Es una clave. */
  protected readonly last = signal<string>(RAN.nothing);

  /**
   * El componente recibe la etiqueta ya traducida.
   * t(showroom.patternEmpty.actions.create, showroom.patternEmpty.actions.clear,
   *   showroom.patternEmpty.actions.retry)
   */
  private readonly actions = translated(
    (t): Readonly<Record<EmptyStateKind, EmptyStateAction | null>> => ({
      [KIND_SNIPPETS.noData]: {
        label: t('showroom.patternEmpty.actions.create'),
        icon: 'plus',
        run: () => this.last.set(RAN.create),
      },
      [KIND_SNIPPETS.noResults]: { label: t(RAN.clear), run: () => this.last.set(RAN.clear) },
      [KIND_SNIPPETS.error]: {
        label: t(RAN.retry),
        icon: 'refresh',
        run: () => this.last.set(RAN.retry),
      },
      [KIND_SNIPPETS.noAccess]: null,
    }),
  );

  protected readonly snippet = [
    '<ewms-empty-state',
    '  kind="no-data"',
    '  title="Todavía no hay expediciones"',
    '  [action]="crear"',
    '/>',
  ].join('\n');

  protected readonly crear = computed(() => this.actions()[KIND_SNIPPETS.noData]);

  protected caseOf(kind: string): Case {
    return CASES.find((item) => item.kind === kind) ?? CASES[0]!;
  }

  protected actionOf(kind: string): EmptyStateAction | null {
    return this.actions()[kind as EmptyStateKind] ?? null;
  }

  protected kindOf(kind: string): EmptyStateKind {
    return kind as EmptyStateKind;
  }

  protected sizeOf(size: string): 'compact' | 'page' {
    return size === 'page' ? 'page' : 'compact';
  }
}
