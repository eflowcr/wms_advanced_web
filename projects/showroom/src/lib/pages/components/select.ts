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
  DESIGN_SYSTEM_VERSION,
  Select,
  type FieldSize,
  type SelectOption,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { formatBox, formatHeight, rectOf, widthOf } from './measure';

/**
 * Solo estados reales del disparador cerrado. Sin Focus ni Open, por lo mismo que en
 * Input (borde en línea atado a una señal); además el panel abierto vive en un
 * overlay del CDK fuera de la tabla.
 */
const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'selected', label: 'Con selección' },
  { id: 'error', label: 'Error' },
  { id: 'disabled', label: 'Disabled' },
];

const SIZES: readonly MatrixAxis[] = [
  { id: 'sm', label: 'Small' },
  { id: 'md', label: 'Medium' },
  { id: 'lg', label: 'Large' },
];

const SIZE_BY_ID: Readonly<Record<string, FieldSize>> = { sm: 'sm', md: 'md', lg: 'lg' };

/** Tamaño único del chevron en píxeles CSS: sm en todos los tamaños de campo. */
const CHEVRON_SIZE = 16;

const OPTIONS: readonly SelectOption[] = [
  { value: 'central', label: 'Almacén central' },
  { value: 'muelle-3', label: 'Muelle 3' },
  { value: 'cuarentena', label: 'Cuarentena' },
  { value: 'devoluciones', label: 'Devoluciones' },
  { value: 'transito', label: 'En tránsito' },
];

/** Verificada contra select.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: '— (requerido)',
    description:
      'Requerido y renderizado como texto visible. Un <button> no es etiquetable, así que se une al trigger con aria-labelledby y no con for/id.',
  },
  {
    name: 'options',
    type: 'readonly SelectOption[]',
    default: '[]',
    description:
      'Las filas, en el orden en que se muestran. SelectOption es { label: string; value: unknown }. Sin límite: la plantilla las renderiza todas.',
  },
  {
    name: 'value',
    type: 'unknown',
    default: 'null',
    description:
      'El valor elegido. Siembra el control; después manda writeValue, es decir el formulario.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'La misma escala del Input y del Botón: 32 / 40 / 48.',
  },
  {
    name: 'placeholder',
    type: 'string',
    default: "''",
    description: 'Lo que muestra el trigger mientras no hay nada elegido. Ya traducido.',
  },
  {
    name: 'hint',
    type: 'string',
    default: "''",
    description: 'Ayuda bajo el trigger, conectada con aria-describedby. Se pone danger con error.',
  },
  {
    name: 'error',
    type: 'boolean',
    default: 'false',
    description:
      'Booleano, no un estado: el Select no tiene read-only. Puramente visual, como el del Input.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Heredado de FormControlBase, combinado con el del formulario por OR.',
  },
];

const ANATOMY = [
  { part: 'Fondo del trigger y del panel', token: '--color-surface' },
  { part: 'Borde default del trigger', token: '--color-border-strong' },
  { part: 'Borde en foco y con el panel abierto', token: '--color-bg-primary' },
  { part: 'Borde en error', token: '--color-bg-danger' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
  { part: 'Color del anillo', token: '--color-focus-ring' },
  { part: 'Fondo deshabilitado', token: '--color-bg-secondary' },
  { part: 'Placeholder, chevron y hint', token: '--color-text-secondary' },
  { part: 'Texto deshabilitado', token: '--color-text-disabled' },
  { part: 'Fondo de la opción activa y del hover', token: '--color-ghost-hover' },
  { part: 'Hint en error', token: '--color-danger-text' },
  { part: 'Radio del trigger y del panel', token: '--radius-control' },
  { part: 'Elevación del panel', token: '--shadow-md' },
  { part: 'Peso de la opción seleccionada', token: '--text-control-selected-weight' },
  { part: 'Chevron y check, los tres tamaños', token: '--size-icon-sm' },
] as const;

interface ChevronSample {
  readonly size: FieldSize;
  readonly label: string;
  readonly trigger: string;
  readonly chevron: string;
  readonly sameChevron: boolean;
}

/**
 * /design-system/components/select: ficha de ewms-select. El panel es el componente, así
 * que la página abre con él desplegado: fila activa, seleccionada, teclado y volteo.
 */
@Component({
  selector: 'ewms-showroom-select',
  imports: [ReactiveFormsModule, Select, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './select.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSelect {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly states = STATES;
  protected readonly sizes = SIZES;
  protected readonly options = OPTIONS;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;

  protected readonly form = new FormGroup({
    ubicacion: new FormControl<unknown>('muelle-3'),
  });

  protected readonly chosen = toSignal(this.form.controls.ubicacion.valueChanges, {
    initialValue: this.form.controls.ubicacion.value,
  });

  protected readonly chevrons = signal<readonly ChevronSample[]>([
    { size: 'sm', label: 'Small', trigger: '…', chevron: '…', sameChevron: false },
    { size: 'md', label: 'Medium', trigger: '…', chevron: '…', sameChevron: false },
    { size: 'lg', label: 'Large', trigger: '…', chevron: '…', sameChevron: false },
  ]);

  protected readonly snippet = [
    '<ewms-select',
    '  formControlName="ubicacion"',
    "  [label]=\"'recepciones.ubicacion' | transloco\"",
    '  [options]="ubicaciones()"',
    "  [placeholder]=\"'comun.elegir' | transloco\"",
    '/>',
  ].join('\n');

  constructor() {
    // El chevron mide 16 px en los tres tamaños; alguien querrá «arreglarlo» a
    // 14 / 16 / 18. Se mide el SVG en los tres y se compara.
    afterNextRender(() => {
      this.chevrons.update((samples) =>
        samples.map((sample) => {
          const root = this.host.nativeElement;
          const selector = `[data-chevron-sample="${sample.size}"]`;
          const trigger = rectOf(root, `${selector} button`);
          const chevron = rectOf(root, `${selector} svg`);
          return {
            ...sample,
            trigger: formatHeight(trigger),
            chevron: formatBox(chevron),
            sameChevron: widthOf(chevron) === CHEVRON_SIZE,
          };
        }),
      );
    });
  }

  protected sizeFor(id: string): FieldSize {
    return SIZE_BY_ID[id] ?? 'md';
  }

  /** Solo la fila «Con selección» arranca con valor. */
  protected valueFor(id: string): unknown {
    return id === 'selected' ? 'muelle-3' : null;
  }

  protected isError(id: string): boolean {
    return id === 'error';
  }

  protected isDisabled(id: string): boolean {
    return id === 'disabled';
  }

  /** Etiqueta de la opción que tiene el formulario, para la lectura en vivo. */
  protected chosenLabel(): string {
    const value = this.chosen();
    return OPTIONS.find((option) => option.value === value)?.label ?? '(sin elegir)';
  }
}
