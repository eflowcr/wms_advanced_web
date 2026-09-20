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
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  Input,
  type FieldSize,
  type FieldState,
  type InputType,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { formatHeight, rectOf, sameHeight } from './measure';

/**
 * The matrix's row axis: the four states that are REAL INPUTS.
 *
 * Focus is deliberately absent. The field's border colour is an inline style
 * bound to the component's own focus signal, and an inline declaration cannot
 * be overridden by the wrapper utility the Button page uses to hold hover
 * still -- so a forced "Focus" cell here would show the ring and the WRONG
 * border, which is worse than not showing it. Focus is demonstrated instead
 * where it can be real: a field you reach with Tab, in block 3.
 */
const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'error', label: 'Error' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'readonly', label: 'Read-only' },
];

const SIZES: readonly MatrixAxis[] = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Medium' },
  { id: 'lg', label: 'Large' },
];

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
  readonly label: string;
  readonly note: string;
}

const TYPES: readonly TypeSample[] = [
  { type: 'text', label: 'text', note: 'El default. Alineado a la izquierda.' },
  {
    type: 'number',
    label: 'number',
    note: 'Alineado a la derecha: los números se comparan dígito a dígito.',
  },
  {
    type: 'password',
    label: 'password',
    note: 'Botón sufijo de mostrar/ocultar. Sólo aparece con sus dos textos.',
  },
  {
    type: 'search',
    label: 'search',
    note: 'Icono prefijo, y botón de limpiar cuando hay algo que limpiar.',
  },
  {
    type: 'textarea',
    label: 'textarea',
    note: 'Otro elemento, mismo borde y mismo radio. Sin redimensionar a mano.',
  },
];

/**
 * VERIFIED AGAINST input.ts, not against the vault sheet. Two rows exist
 * because the sheet was wrong and the code is right -- see block 8.
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: '— (requerido)',
    description:
      'Requerido, y renderizado como un <label for> de verdad. Un placeholder no es un nombre: desaparece al primer carácter y varios lectores de pantalla no lo anuncian nunca.',
  },
  {
    name: 'type',
    type: "'text' | 'number' | 'password' | 'search' | 'textarea'",
    default: "'text'",
    description: 'Los cinco del bloque 4.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'Las mismas tres alturas de control que el Botón y el Select: 32 / 40 / 48.',
  },
  {
    name: 'placeholder',
    type: 'string',
    default: "''",
    description: 'Texto de ejemplo dentro del campo. Nunca sustituye al label.',
  },
  {
    name: 'hint',
    type: 'string',
    default: "''",
    description:
      'Ayuda bajo el campo, conectada con aria-describedby. Se pone en color danger cuando state="error".',
  },
  {
    name: 'state',
    type: "'default' | 'error' | 'disabled' | 'readonly'",
    default: "'default'",
    description:
      'Puramente visual: el componente no valida nada. Quien decide si un valor está mal es el formulario padre.',
  },
  {
    name: 'required',
    type: 'boolean',
    default: 'false',
    description: 'Pinta el asterisco junto al label y pone el atributo nativo.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description:
      'Heredado de FormControlBase. Se combina con el disabled del formulario con OR: quien deshabilita gana.',
  },
  {
    name: 'showPasswordLabel',
    type: 'string',
    default: "''",
    description:
      'Nombre accesible del botón de mostrar contraseña, ya traducido. Sin él (y sin hidePasswordLabel) el botón NO se renderiza.',
  },
  {
    name: 'hidePasswordLabel',
    type: 'string',
    default: "''",
    description: 'El mismo contrato, para ocultar.',
  },
  {
    name: 'clearLabel',
    type: 'string',
    default: "''",
    description:
      'Nombre accesible de la × que vacía un campo de búsqueda. Sin él el botón no se renderiza.',
  },
  {
    name: '(fieldFocus)',
    type: 'output<void>',
    default: '—',
    description:
      'Prefijado a propósito: (focus) nativo burbujea hasta el mismo binding del consumidor. Ver el bloque 8.',
  },
  {
    name: '(fieldBlur)',
    type: 'output<void>',
    default: '—',
    description: 'Lo mismo para (blur). Es también donde el formulario recibe onTouched.',
  },
];

const ANATOMY = [
  { part: 'Fondo del campo', token: '--color-surface' },
  { part: 'Borde en default', token: '--color-border-strong' },
  { part: 'Borde en foco', token: '--color-bg-primary' },
  { part: 'Borde en error', token: '--color-bg-danger' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
  { part: 'Color del anillo', token: '--color-focus-ring' },
  { part: 'Fondo deshabilitado y de sólo lectura', token: '--color-bg-secondary' },
  { part: 'Texto deshabilitado', token: '--color-text-disabled' },
  { part: 'Texto ingresado', token: '--color-text-primary' },
  { part: 'Label, hint e iconos', token: '--color-text-secondary' },
  { part: 'Hint en error', token: '--color-danger-text' },
  { part: 'Borde en sólo lectura', token: '--color-border' },
  { part: 'Radio de esquina', token: '--radius-control' },
  { part: 'Tipografía, tamaño Medium', token: '--text-control-md-size' },
  { part: 'Icono decorativo (prefijo), los tres tamaños', token: '--size-icon-sm' },
] as const;

/** A control height, measured against the Button of the same size. */
interface SizeSample {
  readonly size: FieldSize;
  readonly label: string;
  readonly input: string;
  readonly button: string;
  readonly aligned: boolean;
}

/**
 * /design-system/components/input -- the sheet of `ewms-input`.
 *
 * THE DEMO IS A REAL REACTIVE FORM, and that is not decoration. The component
 * is a `ControlValueAccessor`: what it owes is that `formControlName` reaches
 * it, that typing updates the control and that blur marks it touched. An input
 * shown on its own proves none of those, so the page shows the control's value
 * and its touched flag live underneath.
 */
@Component({
  selector: 'ewms-showroom-input',
  imports: [
    ReactiveFormsModule,
    Button,
    Input,
    DemoFrame,
    PropTable,
    StateMatrix,
    TokenValue,
  ],
  templateUrl: './input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomInput {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly states = STATES;
  protected readonly sizes = SIZES;
  protected readonly types = TYPES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;

  /**
   * The demo form. A real `FormGroup`, with a control that the Input binds to
   * through `formControlName` and nothing else.
   */
  protected readonly form = new FormGroup({
    sku: new FormControl('SKU-04871-B', { nonNullable: true }),
    clave: new FormControl('', { nonNullable: true }),
    busqueda: new FormControl('', { nonNullable: true }),
  });

  /** The control's value, straight from the form -- not from a local copy. */
  protected readonly skuValue = toSignal(this.form.controls.sku.valueChanges, {
    initialValue: this.form.controls.sku.value,
  });

  /** Flipped by the demo's own blur, which is where onTouched fires. */
  protected readonly touched = signal(false);

  /** How many times each prefixed output has fired, so the rename is visible. */
  protected readonly focusCount = signal(0);
  protected readonly blurCount = signal(0);

  protected readonly measured = signal<readonly SizeSample[]>([
    { size: 'sm', label: 'Small', input: '…', button: '…', aligned: false },
    { size: 'md', label: 'Medium', input: '…', button: '…', aligned: false },
    { size: 'lg', label: 'Large', input: '…', button: '…', aligned: false },
  ]);

  protected readonly snippet = [
    '<ewms-input',
    '  formControlName="sku"',
    "  [label]=\"'articulos.sku' | transloco\"",
    "  [hint]=\"'articulos.skuFormato' | transloco\"",
    '  [state]="form.controls.sku.invalid && form.controls.sku.touched ? \'error\' : \'default\'"',
    '  (fieldBlur)="onBlur()"',
    '/>',
  ].join('\n');

  constructor() {
    /*
     * The two heights are measured off the rendered controls and compared
     * here. "Input and Button share the control scale" is the claim; a page
     * that printed 40 next to 40 would keep printing it after they diverged.
     */
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
    this.touched.set(this.form.controls.sku.touched);
  }
}
