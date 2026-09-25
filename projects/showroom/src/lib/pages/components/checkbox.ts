import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { Checkbox, DESIGN_SYSTEM_VERSION } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import {
  readSelectionBox,
  SELECTION_ANATOMY,
  SELECTION_BOX,
  type SelectionBox,
} from './selection-shared';

/**
 * Filas: lo que contiene la casilla. Tres, y la tercera es la que importa.
 * t(showroom.checkbox.states.values.off, showroom.checkbox.states.values.on,
 *   showroom.checkbox.states.values.mixed)
 */
const VALUES: readonly MatrixAxis[] = [
  { id: 'off', label: 'showroom.checkbox.states.values.off' },
  { id: 'on', label: 'showroom.checkbox.states.values.on' },
  { id: 'mixed', label: 'showroom.checkbox.states.values.mixed' },
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

/**
 * Encabezado de la columna de filas: el eje son valores, no variantes. La matriz lo traduce.
 * t(showroom.checkbox.states.rowHeader)
 */
const ROW_HEADER = 'showroom.checkbox.states.rowHeader';

/**
 * Solo Hover y Focus se fuerzan, con los mismos tokens del control. Disabled va como
 * entrada real: pintado con una clase, axe vería un control habilitado en gris.
 */
const FORCED: Readonly<Record<string, string>> = {
  hover: '[&_input]:border-(--color-bg-primary)',
  focus: '[&_input]:shadow-(--focus-ring-shadow)',
};

/**
 * Verificada contra checkbox.ts.
 * t(showroom.checkbox.props.checked, showroom.checkbox.props.indeterminate,
 *   showroom.checkbox.props.label, showroom.checkbox.props.ariaLabel,
 *   showroom.checkbox.props.disabled, showroom.checkbox.props.checkedChange)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'checked',
    type: 'boolean',
    default: 'false',
    description: 'showroom.checkbox.props.checked',
  },
  {
    name: 'indeterminate',
    type: 'boolean',
    default: 'false',
    description: 'showroom.checkbox.props.indeterminate',
  },
  {
    name: 'label',
    type: 'string',
    default: "''",
    description: 'showroom.checkbox.props.label',
  },
  {
    name: 'ariaLabel',
    type: 'string',
    default: "''",
    description: 'showroom.checkbox.props.ariaLabel',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.checkbox.props.disabled',
  },
  {
    name: '(checkedChange)',
    type: 'output<boolean>',
    default: '—',
    description: 'showroom.checkbox.props.checkedChange',
  },
];

/**
 * /design-system/components/checkbox: ficha de ewms-checkbox, para leer junto a Radio y
 * Toggle (los tres son FormCheckboxControl). Solo esta muestra el tercer estado.
 */
@Component({
  selector: 'ewms-showroom-checkbox',
  imports: [
    Checkbox,
    DemoFrame,
    DocTable,
    PropTable,
    Prose,
    StateMatrix,
    TokenValue,
    TranslocoPipe,
  ],
  templateUrl: './checkbox.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomCheckbox {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly values = VALUES;
  protected readonly states = STATES;
  protected readonly rowHeader = ROW_HEADER;
  protected readonly props = PROPS;
  protected readonly anatomy = SELECTION_ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;

  protected readonly box = signal<SelectionBox>(SELECTION_BOX);

  /**
   * Demo de «seleccionar todo»: tres filas y la casilla de cabecera. El SKU es dato; el
   * texto de la fila lo arma la plantilla.
   */
  protected readonly rows = signal<readonly { id: string; sku: string; on: boolean }[]>([
    { id: 'a', sku: 'SKU-04871-B', on: false },
    { id: 'b', sku: 'SKU-04872-C', on: true },
    { id: 'c', sku: 'SKU-04873-D', on: false },
  ]);

  protected readonly allOn = computed(() => this.rows().every((row) => row.on));
  protected readonly someOn = computed(() => this.rows().some((row) => row.on));
  /** Mixto es «algunas, no todas». */
  protected readonly headerMixed = computed(() => this.someOn() && !this.allOn());

  protected readonly snippet = [
    '<ewms-checkbox',
    '  [formField]="alta.reetiquetar"',
    '  [label]="\'articulos.reetiquetar\' | transloco"',
    '  (checkedChange)="onToggle($event)"',
    '/>',
    '',
    '<!-- sin texto visible, en el encabezado de una tabla -->',
    '<ewms-checkbox',
    '  [indeterminate]="algunas() && !todas()"',
    '  [checked]="todas()"',
    '  [ariaLabel]="\'tabla.seleccionarTodo\' | transloco"',
    '  (checkedChange)="marcarTodo($event)"',
    '/>',
  ].join('\n');

  constructor() {
    // 18x18 y borde de 1.5 px. El tamaño se mide; el borde se lee de la declaración
    // porque Chromium redondea hacia abajo un borde subpíxel y reporta un píxel entero.
    afterNextRender(() => {
      this.box.set(readSelectionBox(this.host.nativeElement));
    });
  }

  protected forced(state: string): string {
    return FORCED[state] ?? '';
  }

  protected isOn(value: string): boolean {
    return value === 'on';
  }

  protected isMixed(value: string): boolean {
    return value === 'mixed';
  }

  protected toggleRow(id: string, on: boolean): void {
    this.rows.update((rows) => rows.map((row) => (row.id === id ? { ...row, on } : row)));
  }

  protected toggleAll(on: boolean): void {
    this.rows.update((rows) => rows.map((row) => ({ ...row, on })));
  }
}
