import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { form as signalForm, FormField, required } from '@angular/forms/signals';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  Input,
  type FieldSize,
  type FieldState,
  type InputType,
} from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { formatHeight, rectOf, sameHeight } from './measure';

/**
 * Solo estados que son entradas reales. Sin Focus: el borde es un estilo en línea
 * atado a la señal de foco y el envoltorio no lo puede pisar; mostraría el anillo con
 * el borde equivocado. El foco real se muestra con Tab en el bloque 3.
 * t(showroom.common.states.default, showroom.common.states.error,
 *   showroom.common.states.disabled, showroom.common.states.readOnly)
 */
const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'showroom.common.states.default' },
  { id: 'error', label: 'showroom.common.states.error' },
  { id: 'disabled', label: 'showroom.common.states.disabled' },
  { id: 'readonly', label: 'showroom.common.states.readOnly' },
];

/** t(showroom.common.sizes.sm, showroom.common.sizes.md, showroom.common.sizes.lg) */
const SIZES: readonly MatrixAxis[] = [
  { id: 'sm', label: 'showroom.common.sizes.sm' },
  { id: 'md', label: 'showroom.common.sizes.md' },
  { id: 'lg', label: 'showroom.common.sizes.lg' },
];

/**
 * La matriz cruza estado con tamaño: la columna de filas nombra estados, no variantes.
 * t(showroom.input.states.rowHeader)
 */
const ROW_HEADER = 'showroom.input.states.rowHeader';

const STATE_BY_ID: Readonly<Record<string, FieldState>> = {
  default: 'default',
  error: 'error',
  disabled: 'disabled',
  readonly: 'readonly',
};

const SIZE_BY_ID: Readonly<Record<string, FieldSize>> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

interface TypeSample {
  readonly type: InputType;
  readonly note: string;
}

/**
 * t(showroom.input.variants.notes.text, showroom.input.variants.notes.number,
 *   showroom.input.variants.notes.password, showroom.input.variants.notes.search,
 *   showroom.input.variants.notes.textarea)
 */
const TYPES: readonly TypeSample[] = [
  { type: 'text', note: 'showroom.input.variants.notes.text' },
  { type: 'number', note: 'showroom.input.variants.notes.number' },
  { type: 'password', note: 'showroom.input.variants.notes.password' },
  { type: 'search', note: 'showroom.input.variants.notes.search' },
  { type: 'textarea', note: 'showroom.input.variants.notes.textarea' },
];

/**
 * Verificada contra input.ts, no contra la ficha: dos filas corrigen la ficha (bloque 8).
 * t(showroom.input.props.label, showroom.input.props.type, showroom.input.props.size,
 *   showroom.input.props.placeholder, showroom.input.props.hint, showroom.input.props.state,
 *   showroom.input.props.required, showroom.input.props.disabled,
 *   showroom.input.props.showPasswordLabel, showroom.input.props.hidePasswordLabel,
 *   showroom.input.props.clearLabel, showroom.input.props.fieldFocus,
 *   showroom.input.props.fieldBlur)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: '—',
    description: 'showroom.input.props.label',
  },
  {
    name: 'type',
    type: "'text' | 'number' | 'password' | 'search' | 'textarea'",
    default: "'text'",
    description: 'showroom.input.props.type',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'showroom.input.props.size',
  },
  {
    name: 'placeholder',
    type: 'string',
    default: "''",
    description: 'showroom.input.props.placeholder',
  },
  {
    name: 'hint',
    type: 'string',
    default: "''",
    description: 'showroom.input.props.hint',
  },
  {
    name: 'state',
    type: "'default' | 'error' | 'disabled' | 'readonly'",
    default: "'default'",
    description: 'showroom.input.props.state',
  },
  {
    name: 'required',
    type: 'boolean',
    default: 'false',
    description: 'showroom.input.props.required',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.input.props.disabled',
  },
  {
    name: 'showPasswordLabel',
    type: 'string',
    default: "''",
    description: 'showroom.input.props.showPasswordLabel',
  },
  {
    name: 'hidePasswordLabel',
    type: 'string',
    default: "''",
    description: 'showroom.input.props.hidePasswordLabel',
  },
  {
    name: 'clearLabel',
    type: 'string',
    default: "''",
    description: 'showroom.input.props.clearLabel',
  },
  {
    name: '(fieldFocus)',
    type: 'output<void>',
    default: '—',
    description: 'showroom.input.props.fieldFocus',
  },
  {
    name: '(fieldBlur)',
    type: 'output<void>',
    default: '—',
    description: 'showroom.input.props.fieldBlur',
  },
];

/**
 * t(showroom.input.anatomy.parts.background, showroom.input.anatomy.parts.border,
 *   showroom.input.anatomy.parts.focusBorder, showroom.input.anatomy.parts.errorBorder,
 *   showroom.input.anatomy.parts.focusRing, showroom.input.anatomy.parts.ringColor,
 *   showroom.input.anatomy.parts.mutedBackground, showroom.input.anatomy.parts.disabledText,
 *   showroom.input.anatomy.parts.text, showroom.input.anatomy.parts.secondaryText,
 *   showroom.input.anatomy.parts.errorHint, showroom.input.anatomy.parts.readOnlyBorder,
 *   showroom.input.anatomy.parts.radius, showroom.input.anatomy.parts.fontSize,
 *   showroom.input.anatomy.parts.prefixIcon)
 */
const ANATOMY = [
  { part: 'showroom.input.anatomy.parts.background', token: '--color-surface' },
  { part: 'showroom.input.anatomy.parts.border', token: '--color-border-strong' },
  { part: 'showroom.input.anatomy.parts.focusBorder', token: '--color-bg-primary' },
  { part: 'showroom.input.anatomy.parts.errorBorder', token: '--color-bg-danger' },
  { part: 'showroom.input.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
  { part: 'showroom.input.anatomy.parts.ringColor', token: '--color-focus-ring' },
  { part: 'showroom.input.anatomy.parts.mutedBackground', token: '--color-bg-secondary' },
  { part: 'showroom.input.anatomy.parts.disabledText', token: '--color-text-disabled' },
  { part: 'showroom.input.anatomy.parts.text', token: '--color-text-primary' },
  { part: 'showroom.input.anatomy.parts.secondaryText', token: '--color-text-secondary' },
  { part: 'showroom.input.anatomy.parts.errorHint', token: '--color-danger-text' },
  { part: 'showroom.input.anatomy.parts.readOnlyBorder', token: '--color-border' },
  { part: 'showroom.input.anatomy.parts.radius', token: '--radius-control' },
  { part: 'showroom.input.anatomy.parts.fontSize', token: '--text-control-md-size' },
  { part: 'showroom.input.anatomy.parts.prefixIcon', token: '--size-icon-sm' },
] as const;

/** Altura de control, medida contra el Button del mismo tamaño. */
interface SizeSample {
  readonly size: FieldSize;
  readonly label: string;
  readonly input: string;
  readonly button: string;
  readonly aligned: boolean;
}

/**
 * /design-system/components/input: ficha de ewms-input. La demo es un formulario reactivo
 * real y muestra en vivo el valor y el touched, que es lo que el CVA debe cumplir.
 */
@Component({
  selector: 'ewms-showroom-input',
  imports: [
    FormField,
    Button,
    Input,
    DemoFrame,
    DocTable,
    PropTable,
    Prose,
    StateMatrix,
    TokenValue,
    TranslocoPipe,
  ],
  templateUrl: './input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomInput {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly states = STATES;
  protected readonly sizes = SIZES;
  protected readonly rowHeader = ROW_HEADER;
  protected readonly types = TYPES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;

  /** Un form() real; el Input se enlaza solo por [formField]. */
  protected readonly model = signal({ sku: 'SKU-04871-B', clave: '', busqueda: '' });

  /**
   * `required` va en el esquema y no en la plantilla: Angular prohíbe enlazar `[required]` en el
   * mismo nodo que `[formField]`, para que el campo tenga un solo dueño.
   */
  protected readonly form = signalForm(this.model, (path) => {
    required(path.sku);
  });

  /** Valor tomado del formulario, no de una copia local. */
  protected readonly skuValue = computed(() => this.form.sku().value());

  /** Lo cambia el blur de la demo, que es donde se dispara onTouched. */
  protected readonly touched = signal(false);

  /** Veces que se disparó cada salida con prefijo, para que se vea el renombre. */
  protected readonly focusCount = signal(0);
  protected readonly blurCount = signal(0);

  /** t(showroom.common.sizes.sm, showroom.common.sizes.md, showroom.common.sizes.lg) */
  protected readonly measured = signal<readonly SizeSample[]>([
    { size: 'sm', label: 'showroom.common.sizes.sm', input: '…', button: '…', aligned: false },
    { size: 'md', label: 'showroom.common.sizes.md', input: '…', button: '…', aligned: false },
    { size: 'lg', label: 'showroom.common.sizes.lg', input: '…', button: '…', aligned: false },
  ]);

  protected readonly snippet = [
    '<ewms-input',
    '  [formField]="alta.sku"',
    "  [label]=\"'articulos.sku' | transloco\"",
    "  [hint]=\"'articulos.skuFormato' | transloco\"",
    '  [state]="form.controls.sku.invalid && form.controls.sku.touched ? \'error\' : \'default\'"',
    '  (fieldBlur)="onBlur()"',
    '/>',
  ].join('\n');

  constructor() {
    // Se miden y comparan las dos alturas: Input y Button comparten la escala de control.
    afterNextRender(() => {
      this.measured.update((samples) =>
        samples.map((sample) => {
          const root = this.host.nativeElement;
          const field = rectOf(root, `[data-pair="${sample.size}"] input`);
          const button = rectOf(root, `[data-pair="${sample.size}"] button`);
          return {
            ...sample,
            input: formatHeight(field),
            button: formatHeight(button),
            aligned: sameHeight(field, button),
          };
        }),
      );
    });
  }

  protected stateFor(id: string): FieldState {
    return STATE_BY_ID[id] ?? 'default';
  }

  protected sizeFor(id: string): FieldSize {
    return SIZE_BY_ID[id] ?? 'md';
  }

  protected onFocus(): void {
    this.focusCount.update((count) => count + 1);
  }

  protected onBlur(): void {
    this.blurCount.update((count) => count + 1);
    this.touched.set(this.form.sku().touched());
  }
}
