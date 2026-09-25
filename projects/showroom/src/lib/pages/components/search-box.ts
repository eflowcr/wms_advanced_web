import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DESIGN_SYSTEM_VERSION, SearchBox } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';

/**
 * Verificada contra search-box.ts.
 * t(showroom.searchBox.props.value, showroom.searchBox.props.label,
 *   showroom.searchBox.props.placeholder, showroom.searchBox.props.shortcut,
 *   showroom.searchBox.props.disabled, showroom.searchBox.props.messages,
 *   showroom.searchBox.props.searchSubmit, showroom.searchBox.props.focus)
 */
const PROPS: readonly PropRow[] = [
  {
    name: '[(value)]',
    type: 'string',
    default: "''",
    description: 'showroom.searchBox.props.value',
  },
  { name: 'label', type: 'string', default: '—', description: 'showroom.searchBox.props.label' },
  {
    name: 'placeholder',
    type: 'string',
    default: "''",
    description: 'showroom.searchBox.props.placeholder',
  },
  {
    name: 'shortcut',
    type: 'string',
    default: "''",
    description: 'showroom.searchBox.props.shortcut',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.searchBox.props.disabled',
  },
  {
    name: 'messages',
    type: 'Partial<SearchBoxMessages> | null',
    default: 'null',
    description: 'showroom.searchBox.props.messages',
  },
  {
    name: '(searchSubmit)',
    type: 'output<string>',
    default: '—',
    description: 'showroom.searchBox.props.searchSubmit',
  },
  {
    name: 'focus()',
    type: '() => void',
    default: '—',
    description: 'showroom.searchBox.props.focus',
  },
];

/** t(showroom.searchBox.states.rows.empty, showroom.searchBox.states.rows.filled) */
const CONTENTS: readonly MatrixAxis[] = [
  { id: 'empty', label: 'showroom.searchBox.states.rows.empty' },
  { id: 'filled', label: 'showroom.searchBox.states.rows.filled' },
];

/**
 * t(showroom.common.states.default, showroom.common.states.hover, showroom.common.states.focus,
 *   showroom.common.states.disabled)
 */
const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'showroom.common.states.default' },
  { id: 'hover', label: 'showroom.common.states.hover' },
  { id: 'focus', label: 'showroom.common.states.focus' },
  { id: 'disabled', label: 'showroom.common.states.disabled' },
];

/** Estados en filas y contenido en columnas: dos píldoras anchas por fila. t(showroom.searchBox.states.rowHeader) */
const ROW_HEADER = 'showroom.searchBox.states.rowHeader';

/** Hover y foco forzados con la misma utilidad del token que usa el componente. */
const FORCED_STATE_CLASSES: Readonly<Record<string, string>> = {
  hover: '[&_[data-search-field]]:border-strong-hover [&_[data-search-submit]]:bg-secondary-hover',
  focus:
    '[&_[data-search-field]]:border-(color:--color-focus-ring) ' +
    '[&_[data-search-field]]:shadow-(--focus-ring-shadow)',
};

/**
 * t(showroom.searchBox.anatomy.parts.shape, showroom.searchBox.anatomy.parts.border,
 *   showroom.searchBox.anatomy.parts.borderHover, showroom.searchBox.anatomy.parts.borderFocus,
 *   showroom.searchBox.anatomy.parts.focusRing, showroom.searchBox.anatomy.parts.field,
 *   showroom.searchBox.anatomy.parts.button, showroom.searchBox.anatomy.parts.buttonHover,
 *   showroom.searchBox.anatomy.parts.hint, showroom.searchBox.anatomy.parts.maxWidth)
 */
const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'showroom.searchBox.anatomy.parts.shape', token: '--radius-full' },
  { part: 'showroom.searchBox.anatomy.parts.border', token: '--color-border-strong' },
  { part: 'showroom.searchBox.anatomy.parts.borderHover', token: '--color-border-strong-hover' },
  { part: 'showroom.searchBox.anatomy.parts.borderFocus', token: '--color-focus-ring' },
  { part: 'showroom.searchBox.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
  { part: 'showroom.searchBox.anatomy.parts.field', token: '--color-surface' },
  { part: 'showroom.searchBox.anatomy.parts.button', token: '--color-bg-secondary' },
  { part: 'showroom.searchBox.anatomy.parts.buttonHover', token: '--color-bg-secondary-hover' },
  { part: 'showroom.searchBox.anatomy.parts.hint', token: '--color-text-secondary' },
  { part: 'showroom.searchBox.anatomy.parts.maxWidth', token: '--search-max-width' },
];

/**
 * /design-system/components/search-box: el buscador de la cabecera. Estructura de YouTube, pintura
 * del sistema (decisión del usuario, 2026-09-25).
 */
@Component({
  selector: 'ewms-showroom-search-box',
  templateUrl: './search-box.html',
  imports: [SearchBox, DemoFrame, PropTable, Prose, StateMatrix, TokenValue, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSearchBox {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly contents = CONTENTS;
  protected readonly states = STATES;
  protected readonly rowHeader = ROW_HEADER;
  protected readonly anatomy = ANATOMY;

  /** Lo último que se buscó, para ver que sale normalizado. `null` hasta la primera búsqueda. */
  protected readonly last = signal<string | null>(null);

  protected readonly snippet = [
    '<ewms-search-box',
    '  [label]="\'shell.search.label\' | transloco"',
    '  [placeholder]="\'shell.search.placeholder\' | transloco"',
    '  shortcut="/"',
    '  (searchSubmit)="buscar($event)"',
    '/>',
  ].join('\n');

  protected forcedClasses(state: string): string {
    return FORCED_STATE_CLASSES[state] ?? '';
  }

  protected onSearch(query: string): void {
    this.last.set(query);
  }
}
