import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { form as signalForm, FormField } from '@angular/forms/signals';
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

/** Selector de almacén de la ficha; el cuarto no está disponible. */
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
 * Hover forzado con el mismo token del componente. Vive en la página, no en el widget,
 * junto a las clases con que se compara.
 */
const FORCED_HOVER = '[&_[role=radio]]:border-(--color-border-strong)';

/** Verificada contra card.ts y card-group.ts. */
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
      'Se suma con OR al de cada card. Deshabilita todas las cards y vacía la parada de tabulación. Dentro de un formulario lo pone la regla disabled() del esquema.',
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
 * /design-system/components/card: ficha de ewms-card y ewms-card-group. Lo que se mide es
 * que el grupo sea una sola parada de tabulador, como un radio: cuenta los tabindex 0.
 */
@Component({
  selector: 'ewms-showroom-card',
  imports: [
    Button,
    Card,
    CardGroup,
    Icon,
    FormField,
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

  protected readonly model = signal<{ almacen: string | null }>({ almacen: 'central' });
  protected readonly form = signalForm(this.model);

  protected readonly chosen = computed(() => this.form.almacen().value());

  /** Paradas de tabulador reales del grupo, contadas en el DOM. */
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

  /** Etiqueta del almacén que tiene el formulario, para la lectura en vivo. */
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

  /** Vacío salvo en la celda de hover; ver FORCED_HOVER. */
  protected forced(variantId: string, stateId: string): string {
    return variantId === 'option' && stateId === 'hover' ? FORCED_HOVER : '';
  }
}
