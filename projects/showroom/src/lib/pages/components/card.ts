import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Button, Card, CardGroup, DESIGN_SYSTEM_VERSION, Icon } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { NOT_MEASURED } from './measure';

interface Warehouse {
  readonly value: string;
  readonly name: string;
  readonly meta: string;
  readonly disabled: boolean;
}

/** The warehouse picker the sheet describes, the fourth one unavailable. */
const WAREHOUSES: readonly Warehouse[] = [
  { value: 'norte', name: 'Norte', meta: '4 muelles · 12 pasillos', disabled: false },
  { value: 'central', name: 'Central', meta: '9 muelles · 34 pasillos', disabled: false },
  { value: 'devoluciones', name: 'Devoluciones', meta: '1 muelle · 4 pasillos', disabled: false },
  { value: 'sur', name: 'Sur', meta: 'En mantenimiento', disabled: true },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = [
  { id: 'option', label: 'Seleccionable (en grupo)' },
  { id: 'content', label: 'De contenido (suelta)' },
];

const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'selected', label: 'Selected' },
  { id: 'disabled', label: 'Disabled' },
];

/**
 * Hover forced with the same token the component's own rule uses, so the cell
 * is the component and not a drawing of it. The forcing lives on the page and
 * not in the widget, next to the classes a reviewer would compare it against.
 */
const FORCED_HOVER = '[&_[role=radio]]:border-(--color-border-strong)';

/** VERIFIED AGAINST card.ts AND card-group.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'card: optionValue',
    type: 'unknown',
    default: 'null',
    description:
      'Cuánto vale esta card cuando es la elegida. Sin sentido fuera de un grupo. No se llama value: value es del grupo, que es a lo que se ata el formulario.',
  },
  {
    name: 'card: disabled',
    type: 'boolean',
    default: 'false',
    description: 'El disabled propio de la card. El del grupo se suma con OR, nunca se resta.',
  },
  {
    name: 'group: value',
    type: 'unknown',
    default: 'null',
    description: 'El valor elegido. Siembra el control; después manda writeValue, es decir el formulario.',
  },
  {
    name: 'group: label',
    type: 'string',
    default: '— (requerido)',
    description: 'Nombra el radiogroup para la tecnología asistiva. Ya traducido.',
  },
  {
    name: 'group: disabled',
    type: 'boolean',
    default: 'false',
    description:
      'Heredado de FormControlBase, combinado con el del formulario por OR. Deshabilita todas las cards y vacía la parada de tabulación.',
  },
  {
    name: '[ewmsCardHeader]',
    type: 'proyección',
    default: '—',
    description: 'Ranura del encabezado. Un atributo sobre cualquier elemento, no una directiva.',
  },
  {
    name: '(contenido por defecto)',
    type: 'proyección',
    default: '—',
    description:
      'El cuerpo. Es la ranura por defecto, así que una card seleccionable se escribe con su contenido directamente adentro.',
  },
  {
    name: '[ewmsCardFooter]',
    type: 'proyección',
    default: '—',
    description: 'Ranura del pie, para las acciones primarias de una card de contenido.',
  },
];

const ANATOMY = [
  { part: 'Fondo en reposo', token: '--color-surface' },
  { part: 'Borde en reposo', token: '--color-border' },
  { part: 'Borde en hover (seleccionable)', token: '--color-border-strong' },
  { part: 'Fondo de la elegida', token: '--color-row-selected' },
  { part: 'Borde y check de la elegida', token: '--color-bg-primary' },
  { part: 'Fondo deshabilitado', token: '--color-bg-secondary' },
  { part: 'Texto deshabilitado', token: '--color-text-disabled' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
  { part: 'Radio de la caja', token: '--radius-md' },
  { part: 'Elevación en reposo', token: '--shadow-sm' },
] as const;

/**
 * /design-system/components/card -- the sheet of `ewms-card` and
 * `ewms-card-group`.
 *
 * THE PAGE'S ONE MEASURED CLAIM IS THE TAB ORDER, and it is the right one to
 * measure: the sheet's whole ask is "the same group semantics as a radio", and
 * the part of that people quietly drop is that a group is ONE tab stop. A page
 * that only said so would be a promise; this one counts the elements that
 * carry `tabindex="0"` and shows the number.
 */
@Component({
  selector: 'ewms-showroom-card',
  imports: [
    Button,
    Card,
    CardGroup,
    Icon,
    ReactiveFormsModule,
    DemoFrame,
    PropTable,
    StateMatrix,
    TokenValue,
  ],
  templateUrl: './card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomCard {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly warehouses = WAREHOUSES;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;

  protected readonly form = new FormGroup({
    almacen: new FormControl<unknown>('central'),
  });

  protected readonly chosen = toSignal(this.form.controls.almacen.valueChanges, {
    initialValue: this.form.controls.almacen.value,
  });

  /** How many tab stops the demo group really has, counted off the DOM. */
  protected readonly tabStops = signal(NOT_MEASURED);
  protected readonly cardsInGroup = signal(NOT_MEASURED);
  protected readonly isOneStop = signal(false);

  protected readonly snippet = [
    '<ewms-card-group',
    '  formControlName="almacen"',
    "  [label]=\"'recepciones.almacen' | transloco\"",
    '>',
    '  @for (almacen of almacenes(); track almacen.id) {',
    '    <ewms-card [optionValue]="almacen.id" [disabled]="!almacen.activo">',
    '      <span class="text-h4">{{ almacen.nombre }}</span>',
    '      <!-- sin text-secondary: sobre el tinte de la elegida da 4.35:1 -->',
    '      <span class="text-caption">{{ almacen.meta }}</span>',
    '    </ewms-card>',
    '  }',
    '</ewms-card-group>',
  ].join('\n');

  constructor() {
    afterNextRender(() => {
      const group = this.host.nativeElement.querySelector('[data-demo-warehouses]');
      if (!group) {
        return;
      }
      const cards = group.querySelectorAll('[role="radio"]');
      const stops = group.querySelectorAll('[role="radio"][tabindex="0"]');
      this.cardsInGroup.set(String(cards.length));
      this.tabStops.set(String(stops.length));
      this.isOneStop.set(stops.length === 1 && cards.length > 1);
    });
  }

  /** The label of the warehouse the form holds, for the live readout. */
  protected chosenLabel(): string {
    const value = this.chosen();
    return WAREHOUSES.find((warehouse) => warehouse.value === value)?.name ?? '(ninguno)';
  }

  protected isOption(variantId: string): boolean {
    return variantId === 'option';
  }

  protected matrixValue(stateId: string): unknown {
    return stateId === 'selected' ? 'central' : null;
  }

  protected matrixDisabled(stateId: string): boolean {
    return stateId === 'disabled';
  }

  /** Empty unless the cell is the hover one; see FORCED_HOVER. */
  protected forced(variantId: string, stateId: string): string {
    return variantId === 'option' && stateId === 'hover' ? FORCED_HOVER : '';
  }
}
