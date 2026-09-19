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

/** The row axis: what the box holds. Three, and the third is the point. */
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
 * The forced states.
 *
 * Only Hover and Focus are forced, with the same tokens the control's own
 * rules use. Disabled is a real input, which matters beyond honesty: painted
 * with a class it would leave axe looking at an enabled control in the
 * disabled palette.
 */
const FORCED: Readonly<Record<string, string>> = {
  hover: '[&_input]:border-(--color-bg-primary)',
  focus: '[&_input]:shadow-(--focus-ring-shadow)',
};

/** VERIFIED AGAINST checkbox.ts. */
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
    description: 'De FormControlBase. Se combina con el del formulario con OR — ver el bloque 8.',
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
 * /design-system/components/checkbox -- the sheet of `ewms-checkbox`.
 *
 * Read it next to the Radio and the Toggle: the three share `FormControlBase`
 * and the three are `ControlValueAccessor`, and the comparison between them is
 * part of the information. The one thing only this page can show is the third
 * state.
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

  /** The «select all» demo: three rows and the header box above them. */
  protected readonly rows = signal<readonly { id: string; label: string; on: boolean }[]>([
    { id: 'a', label: 'Reetiquetar SKU-04871-B', on: false },
    { id: 'b', label: 'Reetiquetar SKU-04872-C', on: true },
    { id: 'c', label: 'Reetiquetar SKU-04873-D', on: false },
  ]);

  protected readonly allOn = computed(() => this.rows().every((row) => row.on));
  protected readonly someOn = computed(() => this.rows().some((row) => row.on));
  /** Mixed is "some but not all" -- the only claim the header box can honestly make. */
  protected readonly headerMixed = computed(() => this.someOn() && !this.allOn());

  protected readonly snippet = [
    '<ewms-checkbox',
    '  formControlName="reetiquetar"',
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
    /*
     * 18x18 and a 1.5 px border are the claims. The size is measured off the
     * rendered control; the border is read as the DECLARATION, because
     * Chromium floors a sub-pixel border and reports a whole pixel whatever
     * the token says. What the component owes is the token; what the browser does with
     * it is the browser's.
     */
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
