import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  DESIGN_SYSTEM_VERSION,
  EmptyState,
  type EmptyStateAction,
  type EmptyStateKind,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';

/** Verificada contra empty-state.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'kind',
    type: "'no-data' | 'no-results' | 'error' | 'no-access'",
    default: "'no-data'",
    description: 'Por qué no hay nada. Decide el ícono, el color de la acción y si se anuncia.',
  },
  {
    name: 'title',
    type: 'string',
    default: '— (requerido)',
    description: 'Ya traducido. No sale como tooltip del navegador aunque se escriba literal.',
  },
  {
    name: 'description',
    type: 'string',
    default: "''",
    description: 'Una o dos líneas. En no-access dice a quién pedir el permiso.',
  },
  {
    name: 'action',
    type: 'EmptyStateAction | null',
    default: 'null',
    description: '{ label, icon?, run }: una sola. Primaria en no-data; secundaria en los demás.',
  },
  {
    name: 'size',
    type: "'compact' | 'page'",
    default: "'page'",
    description: 'compact dentro de tabla, panel o card; page ocupa la pantalla.',
  },
  {
    name: 'icon',
    type: 'IconName | null',
    default: 'null',
    description: 'Solo no-data: el ícono del contexto, del catálogo (package si no se dice).',
  },
];

interface Case {
  readonly kind: EmptyStateKind;
  readonly when: string;
  readonly icon: string;
  readonly action: string;
  readonly title: string;
  readonly description: string;
}

const CASES: readonly Case[] = [
  {
    kind: 'no-data',
    when: 'No hay registros todavía',
    icon: 'el del contexto (package)',
    action: 'La primaria del contexto: «Crear expedición»',
    title: 'Todavía no hay expediciones',
    description: 'Se crean al cerrar una ola de picking, o a mano.',
  },
  {
    kind: 'no-results',
    when: 'Hay registros, pero la búsqueda o los filtros no dejan ninguno',
    icon: 'search',
    action: '«Limpiar filtros»',
    title: 'Ninguna expedición coincide',
    description: 'Probá con otra búsqueda o limpiá los filtros.',
  },
  {
    kind: 'error',
    when: 'La fuente falló',
    icon: 'alert-triangle',
    action: '«Reintentar»',
    title: 'No se pudieron cargar las expediciones',
    description: 'El servicio no respondió a tiempo.',
  },
  {
    kind: 'no-access',
    when: 'Sin permiso',
    icon: 'lock',
    action: 'Ninguna: el texto dice a quién pedirlo',
    title: 'No tenés acceso a las expediciones',
    description: 'Pedíselo al supervisor de tu almacén.',
  },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = CASES.map((item) => ({
  id: item.kind,
  label: item.kind,
}));

const MATRIX_SIZES: readonly MatrixAxis[] = [
  { id: 'compact', label: 'compact — tabla, panel, card' },
  { id: 'page', label: 'page — pantalla entera' },
];

const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'Título en compact', token: '--text-h4-size' },
  { part: 'Título en page', token: '--text-h3-size' },
  { part: 'Texto secundario', token: '--color-text-secondary' },
  { part: 'Círculo del ícono', token: '--color-bg-secondary' },
  { part: 'Círculo del ícono en error', token: '--color-danger-surface' },
  { part: 'Ícono en compact / page', token: '--size-icon-lg' },
];

/**
 * /design-system/patterns/empty-state: el estado vacío único, con sus cuatro casos. La tabla y el
 * select lo usan solos; una pantalla lo pone con una línea.
 */
@Component({
  selector: 'ewms-showroom-empty-state',
  templateUrl: './empty-state.html',
  imports: [EmptyState, DemoFrame, DocTable, PropTable, StateMatrix, TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomEmptyState {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly cases = CASES;
  protected readonly anatomy = ANATOMY;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixSizes = MATRIX_SIZES;

  /** Lo último que se pidió desde una acción, para ver que cada una dispara. */
  protected readonly last = signal('(todavía nada)');

  private readonly actions: Readonly<Record<EmptyStateKind, EmptyStateAction | null>> = {
    'no-data': { label: 'Crear expedición', icon: 'plus', run: () => this.last.set('Crear') },
    'no-results': { label: 'Limpiar filtros', run: () => this.last.set('Limpiar filtros') },
    error: { label: 'Reintentar', icon: 'refresh', run: () => this.last.set('Reintentar') },
    'no-access': null,
  };

  protected readonly snippet = [
    '<ewms-empty-state',
    '  kind="no-data"',
    '  title="Todavía no hay expediciones"',
    '  [action]="crear"',
    '/>',
  ].join('\n');

  protected readonly crear = this.actions['no-data'];

  protected caseOf(kind: string): Case {
    return CASES.find((item) => item.kind === kind) ?? CASES[0]!;
  }

  protected actionOf(kind: string): EmptyStateAction | null {
    return this.actions[kind as EmptyStateKind] ?? null;
  }

  protected kindOf(kind: string): EmptyStateKind {
    return kind as EmptyStateKind;
  }

  protected sizeOf(size: string): 'compact' | 'page' {
    return size === 'page' ? 'page' : 'compact';
  }
}
