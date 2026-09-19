import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DESIGN_SYSTEM_VERSION, Radio } from '@ewms/design-system';
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

/**
 * The row axis: two, not three.
 *
 * A radio has no indeterminate state, and the absence is information -- it is
 * the one place where the two selection controls, which share everything else,
 * genuinely differ in what they can express.
 */
const VALUES: readonly MatrixAxis[] = [
  { id: 'off', label: 'Sin elegir' },
  { id: 'on', label: 'Elegido' },
];

const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'focus', label: 'Focus' },
  { id: 'disabled', label: 'Disabled' },
];

/** The identity every matrix cell offers; «elegido» is its control holding it. */
const CELL_VALUE = 'la-elegida';

/** Same two forced states, same two tokens as the Checkbox: they share the code. */
const FORCED: Readonly<Record<string, string>> = {
  hover: '[&_input]:border-(--color-bg-primary)',
  focus: '[&_input]:shadow-(--focus-ring-shadow)',
};

interface Option {
  readonly value: string;
  readonly label: string;
}

const RECEPTION_TYPES: readonly Option[] = [
  { value: 'proveedor', label: 'De proveedor' },
  { value: 'devolucion', label: 'Devolución de cliente' },
  { value: 'traslado', label: 'Traslado entre almacenes' },
];

/** VERIFIED AGAINST radio.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'value',
    type: 'unknown',
    default: '— (requerido)',
    description:
      'Lo que el valor del GRUPO pasa a ser cuando se elige esta opción. No es el valor del grupo: es lo que esta opción aporta al ser la elegida.',
  },
  {
    name: 'name',
    type: 'string',
    default: '— (requerido)',
    description:
      'El grupo. Requerido porque el name compartido ES la agrupación: sin él queda un radio en un grupo de uno, que es un checkbox que no se puede apagar.',
  },
  {
    name: 'label',
    type: 'string',
    default: "''",
    description: 'Texto visible al lado del punto, ya traducido.',
  },
  {
    name: 'ariaLabel',
    type: 'string',
    default: "''",
    description: 'El nombre accesible cuando no hay texto visible.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'De FormControlBase, combinado con el del formulario por OR — ver el bloque 8.',
  },
  {
    name: '(valueChange)',
    type: 'output<unknown>',
    default: '—',
    description:
      'NO se llama (change): ese nombre es nativo y burbujea. Emite el value de esta opción. Ver el bloque 8.',
  },
];

/**
 * /design-system/components/radio -- the sheet of `ewms-radio`.
 *
 * Its twin is the Checkbox, and the pages are written to be read together: the
 * anatomy table is literally the same constant, because the two components
 * share `selection.types.ts`.
 */
@Component({
  selector: 'ewms-showroom-radio',
  imports: [ReactiveFormsModule, Radio, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './radio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomRadio {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly values = VALUES;
  protected readonly states = STATES;
  protected readonly options = RECEPTION_TYPES;
  protected readonly props = PROPS;
  protected readonly anatomy = SELECTION_ANATOMY;

  protected readonly box = signal<SelectionBox>(SELECTION_BOX);

  protected readonly form = new FormGroup({
    tipo: new FormControl<unknown>('proveedor'),
  });

  protected readonly chosen = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });

  protected readonly snippet = [
    '<fieldset>',
    "  <legend>{{ 'recepciones.tipo' | transloco }}</legend>",
    '  @for (opcion of tipos(); track opcion.value) {',
    '    <ewms-radio',
    '      formControlName="tipo"',
    '      name="tipo-recepcion"',
    '      [value]="opcion.value"',
    '      [label]="opcion.label"',
    '    />',
    '  }',
    '</fieldset>',
  ].join('\n');

  constructor() {
    afterNextRender(() => {
      this.box.set(readSelectionBox(this.host.nativeElement));
    });
  }

  protected forced(state: string): string {
    return FORCED[state] ?? '';
  }

  /**
   * One `FormControl` per cell of the matrix, and one native `name` per cell
   * too.
   *
   * `checked` on a Radio is DERIVED -- `controlValue() === value()` -- and is
   * not an input, precisely so a group can never end up with two dots in it.
   * The consequence for a page like this one is that a cell cannot be told to
   * look chosen: it has to actually be the chosen option of a group. So every
   * cell gets its own group of one, seeded with the value that makes it so.
   *
   * Sharing one control between the cells would have been shorter and wrong:
   * clicking any «Sin elegir» cell would have lit up all of them at once.
   */
  private readonly cellControls = new Map<string, FormControl<unknown>>();

  protected controlFor(value: string, state: string): FormControl<unknown> {
    const key = `${value}-${state}`;
    let control = this.cellControls.get(key);
    if (!control) {
      control = new FormControl<unknown>(value === 'on' ? CELL_VALUE : null);
      /*
       * The Disabled column is disabled THROUGH THE FORM, not through the
       * `disabled` input, and that is on purpose twice over: it exercises
       * `setDisabledState` -- the other half of the OR in block 8 -- and it
       * avoids Angular's warning about binding `[disabled]` on an element that
       * already carries a reactive-forms directive.
       */
      if (state === 'disabled') {
        control.disable();
      }
      this.cellControls.set(key, control);
    }
    return control;
  }

  /** The `value` every matrix cell contributes, so «elegido» means equal to it. */
  protected readonly cellValue = CELL_VALUE;

  protected cellName(value: string, state: string): string {
    return `matriz-${value}-${state}`;
  }

  protected chosenLabel(): string {
    return RECEPTION_TYPES.find((option) => option.value === this.chosen())?.label ?? '(ninguno)';
  }
}
