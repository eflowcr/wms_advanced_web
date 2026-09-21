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
 * Dos filas, no tres: un radio no tiene indeterminado. Es la única diferencia real
 * de expresión con el Checkbox, con el que comparte todo lo demás.
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

/** Valor que ofrece cada celda; «elegido» es que su control lo tenga. */
const CELL_VALUE = 'la-elegida';

/** Mismos estados forzados y tokens que el Checkbox: comparten código. */
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

/** Verificada contra radio.ts. */
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
 * /design-system/components/radio: ficha de ewms-radio, gemela de la del Checkbox. La
 * tabla de anatomía es la misma constante porque comparten selection.types.ts.
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
   * Un FormControl y un name por celda: checked es derivado, así que cada celda es su
   * propio grupo de uno. Con un control compartido, un clic en una celda «Sin elegir»
   * las encendía todas.
   */
  private readonly cellControls = new Map<string, FormControl<unknown>>();

  protected controlFor(value: string, state: string): FormControl<unknown> {
    const key = `${value}-${state}`;
    let control = this.cellControls.get(key);
    if (!control) {
      control = new FormControl<unknown>(value === 'on' ? CELL_VALUE : null);
      // Se deshabilita por el formulario, no por la entrada: ejercita setDisabledState
      // (la otra mitad del OR del bloque 8) y evita el aviso de Angular por
      // enlazar [disabled] junto a una directiva de formularios reactivos.
      if (state === 'disabled') {
        control.disable();
      }
      this.cellControls.set(key, control);
    }
    return control;
  }

  /** Valor que aporta cada celda: «elegido» significa igual a este. */
  protected readonly cellValue = CELL_VALUE;

  protected cellName(value: string, state: string): string {
    return `matriz-${value}-${state}`;
  }

  protected chosenLabel(): string {
    return RECEPTION_TYPES.find((option) => option.value === this.chosen())?.label ?? '(ninguno)';
  }
}
