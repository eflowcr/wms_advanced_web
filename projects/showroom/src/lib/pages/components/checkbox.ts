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
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import {
  readSelectionBox,
  SELECTION_ANATOMY,
  SELECTION_BOX,
  type SelectionBox,
} from './selection-shared';

/** Filas: lo que contiene la casilla. Tres, y la tercera es la que importa. */
const VALUES: readonly MatrixAxis[] = [
  { id: 'off', label: 'Sin marcar' },
  { id: 'on', label: 'Marcado' },
  { id: 'mixed', label: 'Indeterminado' },
];

const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'focus', label: 'Focus' },
  { id: 'disabled', label: 'Disabled' },
];

/**
 * Solo Hover y Focus se fuerzan, con los mismos tokens del control. Disabled va como
 * entrada real: pintado con una clase, axe vería un control habilitado en gris.
 */
const FORCED: Readonly<Record<string, string>> = {
  hover: '[&_input]:border-(--color-bg-primary)',
  focus: '[&_input]:shadow-(--focus-ring-shadow)',
};

/** Verificada contra checkbox.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'checked',
    type: 'boolean',
    default: 'false',
    description:
      'Siembra el estado. Después manda el formulario: la clase base lo toma como semilla de un linkedSignal, y writeValue lo pisa.',
  },
  {
    name: 'indeterminate',
    type: 'boolean',
    default: 'false',
    description:
      'Ni marcado ni sin marcar: la casilla de «seleccionar todo» cuando algunas filas están elegidas. Gana sobre checked, visualmente y en lo que se anuncia.',
  },
  {
    name: 'label',
    type: 'string',
    default: "''",
    description:
      'Texto visible al lado de la caja, ya traducido. Opcional porque no siempre se etiqueta en el lugar — el encabezado de una tabla seleccionable es el caso.',
  },
  {
    name: 'ariaLabel',
    type: 'string',
    default: "''",
    description:
      'El nombre accesible cuando no hay texto visible: una columna de casillas por fila, donde el nombre tiene que decir CUÁL fila.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Fuera de un formulario. Dentro de uno lo pone la regla disabled() del esquema — ver el bloque 8.',
  },
  {
    name: '(checkedChange)',
    type: 'output<boolean>',
    default: '—',
    description:
      'NO se llama (change): ese nombre es nativo y burbujea. Ver el bloque 8. Además es el nombre que el Toggle ya tenía, así que los dos controles de selección se leen igual.',
  },
];

/**
 * /design-system/components/checkbox: ficha de ewms-checkbox, para leer junto a Radio y
 * Toggle (los tres son FormCheckboxControl). Solo esta muestra el tercer estado.
 */
@Component({
  selector: 'ewms-showroom-checkbox',
  imports: [Checkbox, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './checkbox.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomCheckbox {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly values = VALUES;
  protected readonly states = STATES;
  protected readonly props = PROPS;
  protected readonly anatomy = SELECTION_ANATOMY;

  protected readonly box = signal<SelectionBox>(SELECTION_BOX);

  /** Demo de «seleccionar todo»: tres filas y la casilla de cabecera. */
  protected readonly rows = signal<readonly { id: string; label: string; on: boolean }[]>([
    { id: 'a', label: 'Reetiquetar SKU-04871-B', on: false },
    { id: 'b', label: 'Reetiquetar SKU-04872-C', on: true },
    { id: 'c', label: 'Reetiquetar SKU-04873-D', on: false },
  ]);

  protected readonly allOn = computed(() => this.rows().every((row) => row.on));
  protected readonly someOn = computed(() => this.rows().some((row) => row.on));
  /** Mixto es «algunas, no todas». */
  protected readonly headerMixed = computed(() => this.someOn() && !this.allOn());

  protected readonly snippet = [
    '<ewms-checkbox',
    '  [formField]="alta.reetiquetar"',
    "  [label]=\"'articulos.reetiquetar' | transloco\"",
    '  (checkedChange)="onToggle($event)"',
    '/>',
    '',
    '<!-- sin texto visible, en el encabezado de una tabla -->',
    '<ewms-checkbox',
    '  [indeterminate]="algunas() && !todas()"',
    '  [checked]="todas()"',
    "  [ariaLabel]=\"'tabla.seleccionarTodo' | transloco\"",
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
