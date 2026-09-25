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
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { translated } from '../../ui/translated';
import {
  readSelectionBox,
  SELECTION_ANATOMY,
  SELECTION_BOX,
  type SelectionBox,
} from './selection-shared';

/**
 * Dos filas, no tres: un radio no tiene indeterminado. Es la única diferencia real
 * de expresión con el Checkbox, con el que comparte todo lo demás.
 * t(showroom.radio.states.values.off, showroom.radio.states.values.on)
 */
const VALUES: readonly MatrixAxis[] = [
  { id: 'off', label: 'showroom.radio.states.values.off' },
  { id: 'on', label: 'showroom.radio.states.values.on' },
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
 * t(showroom.radio.states.rowHeader)
 */
const ROW_HEADER = 'showroom.radio.states.rowHeader';

/** Valor que ofrece cada celda; «elegido» es que su control lo tenga. */
const CELL_VALUE = 'elegida';

/** Mismos estados forzados y tokens que el Checkbox: comparten código. */
const FORCED: Readonly<Record<string, string>> = {
  hover: '[&_input]:border-(--color-bg-primary)',
  focus: '[&_input]:shadow-(--focus-ring-shadow)',
};

interface Option {
  readonly value: string;
  readonly label: string;
}

/**
 * El código es dato; el nombre que la interfaz le da es clave.
 * t(showroom.radio.demo.types.supplier, showroom.radio.demo.types.customerReturn,
 *   showroom.radio.demo.types.transfer)
 */
const RECEPTION_TYPES: readonly Option[] = [
  { value: 'proveedor', label: 'showroom.radio.demo.types.supplier' },
  { value: 'devolucion', label: 'showroom.radio.demo.types.customerReturn' },
  { value: 'traslado', label: 'showroom.radio.demo.types.transfer' },
];

/** t(showroom.radio.demo.noneChosen) */
const NONE_CHOSEN = 'showroom.radio.demo.noneChosen';

/**
 * Verificada contra radio.ts.
 * t(showroom.radio.props.value, showroom.radio.props.disabled, showroom.radio.props.label,
 *   showroom.radio.props.ariaLabel)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'value',
    type: 'unknown',
    default: '—',
    description: 'showroom.radio.props.value',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.radio.props.disabled',
  },
  {
    name: 'label',
    type: 'string',
    default: "''",
    description: 'showroom.radio.props.label',
  },
  {
    name: 'ariaLabel',
    type: 'string',
    default: "''",
    description: 'showroom.radio.props.ariaLabel',
  },
];

/**
 * Verificada contra radio-group.ts.
 * t(showroom.radio.groupProps.value, showroom.radio.groupProps.label,
 *   showroom.radio.groupProps.hideLabelHint, showroom.radio.groupProps.name,
 *   showroom.radio.groupProps.formState)
 */
const GROUP_PROPS: readonly PropRow[] = [
  {
    name: 'value',
    type: 'model<unknown>',
    default: 'null',
    description: 'showroom.radio.groupProps.value',
  },
  {
    name: 'label',
    type: 'string',
    default: '—',
    description: 'showroom.radio.groupProps.label',
  },
  {
    name: 'hideLabel · hint',
    type: 'boolean · string',
    default: "false · ''",
    description: 'showroom.radio.groupProps.hideLabelHint',
  },
  {
    name: 'name',
    type: 'string',
    default: "''",
    description: 'showroom.radio.groupProps.name',
  },
  {
    name: 'disabled · required · invalid · touched · errors',
    type: 'FormValueControl',
    default: '—',
    description: 'showroom.radio.groupProps.formState',
  },
];

/**
 * /design-system/components/radio: ficha de ewms-radio, gemela de la del Checkbox. La
 * tabla de anatomía es la misma constante porque comparten selection.types.ts.
 */
@Component({
  selector: 'ewms-showroom-radio',
  imports: [
    FormField,
    Radio,
    RadioGroup,
    DemoFrame,
    DocTable,
    PropTable,
    Prose,
    StateMatrix,
    TokenValue,
    TranslocoPipe,
  ],
  templateUrl: './radio.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomRadio {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly values = VALUES;
  protected readonly states = STATES;
  protected readonly rowHeader = ROW_HEADER;
  protected readonly props = PROPS;
  protected readonly groupProps = GROUP_PROPS;
  protected readonly anatomy = SELECTION_ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;

  /** Las opciones con su texto ya traducido: ewms-radio recibe la etiqueta escrita. */
  protected readonly options = translated((t) =>
    RECEPTION_TYPES.map((option) => ({ value: option.value, label: t(option.label) })),
  );
  private readonly noneChosen = translated((t) => t(NONE_CHOSEN));

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
    return (
      this.options().find((option) => option.value === this.chosen())?.label ?? this.noneChosen()
    );
  }
}
