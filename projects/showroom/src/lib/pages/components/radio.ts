import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { DESIGN_SYSTEM_VERSION, Radio, RadioGroup } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable } from '../../ui/doc-table';
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
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description:
      'Se suma con OR al del grupo, nunca se resta: el grupo deshabilitado apaga a todas sus opciones.',
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
];

/** Verificada contra radio-group.ts. */
const GROUP_PROPS: readonly PropRow[] = [
  {
    name: 'value',
    type: 'model<unknown>',
    default: 'null',
    description:
      'El valor del campo: el value de la opción elegida. Con [formField] lo llena el formulario; fuera de uno, [(value)].',
  },
  {
    name: 'label',
    type: 'string',
    default: '— (requerido)',
    description: 'El legend del fieldset. El grupo es lo que tiene nombre, no cada opción.',
  },
  {
    name: 'hideLabel · hint',
    type: 'boolean · string',
    default: "false · ''",
    description: 'Como en el Input. El mensaje del validador reemplaza al hint.',
  },
  {
    name: 'name',
    type: 'string',
    default: "'' (uno propio)",
    description:
      'El name que comparten los radios nativos, que ES la agrupación. Sin él, uno por instancia: nunca quedan dos grupos mezclados.',
  },
  {
    name: 'disabled · required · invalid · touched · errors',
    type: 'Del contrato FormValueControl',
    default: '—',
    description: 'Las llena el [formField]. Ninguna que el componente no lea.',
  },
];

/**
 * /design-system/components/radio: ficha de ewms-radio, gemela de la del Checkbox. La
 * tabla de anatomía es la misma constante porque comparten selection.types.ts.
 */
@Component({
  selector: 'ewms-showroom-radio',
  imports: [FormField, Radio, RadioGroup, DemoFrame, DocTable, PropTable, StateMatrix, TokenValue],
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
  protected readonly groupProps = GROUP_PROPS;
  protected readonly anatomy = SELECTION_ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;

  protected readonly box = signal<SelectionBox>(SELECTION_BOX);

  protected readonly model = signal<{ tipo: string | null }>({ tipo: 'proveedor' });
  protected readonly form = form(this.model);

  protected readonly chosen = computed(() => this.form.tipo().value());

  protected readonly snippet = [
    '<fieldset>',
    "  <legend>{{ 'recepciones.tipo' | transloco }}</legend>",
    '  @for (opcion of tipos(); track opcion.value) {',
    '    <ewms-radio',
    '      [formField]="alta.tipo"',
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
   * Una señal por celda: `checked` es derivado, así que cada celda es su propio grupo de uno.
   * Con un valor compartido, un clic en una celda «Sin elegir» las encendía todas.
   */
  private readonly cellValues = new Map<string, WritableSignal<unknown>>();

  protected cellFor(value: string, state: string): WritableSignal<unknown> {
    const key = `${value}-${state}`;
    let cell = this.cellValues.get(key);
    if (!cell) {
      cell = signal<unknown>(value === 'on' ? CELL_VALUE : null);
      this.cellValues.set(key, cell);
    }
    return cell;
  }

  /** Valor que aporta cada celda: «elegido» significa igual a este. */
  protected readonly cellValue = CELL_VALUE;

  protected chosenLabel(): string {
    return RECEPTION_TYPES.find((option) => option.value === this.chosen())?.label ?? '(ninguno)';
  }
}
