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
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { translated } from '../../ui/translated';
import { CENTRAL, WAREHOUSES } from './card.fixtures';
import { NOT_MEASURED } from './measure';

/** t(showroom.cards.states.option, showroom.cards.states.content) */
const MATRIX_VARIANTS: readonly MatrixAxis[] = [
  { id: 'option', label: 'showroom.cards.states.option' },
  { id: 'content', label: 'showroom.cards.states.content' },
];

/**
 * t(showroom.common.states.default, showroom.common.states.hover,
 *   showroom.common.states.selected, showroom.common.states.disabled)
 */
const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'showroom.common.states.default' },
  { id: 'hover', label: 'showroom.common.states.hover' },
  { id: 'selected', label: 'showroom.common.states.selected' },
  { id: 'disabled', label: 'showroom.common.states.disabled' },
];

/** t(showroom.cards.states.rowHeader) */
const MATRIX_ROW_HEADER = 'showroom.cards.states.rowHeader';

/**
 * Hover forzado con el mismo token del componente. Vive en la página, no en el widget,
 * junto a las clases con que se compara.
 */
const FORCED_HOVER = '[&_[role=radio]]:border-(--color-border-strong)';

/**
 * Verificada contra card.ts y card-group.ts.
 * t(showroom.cards.props.optionValue, showroom.cards.props.cardDisabled, showroom.cards.props.value,
 *   showroom.cards.props.label, showroom.cards.props.groupDisabled, showroom.cards.props.header,
 *   showroom.cards.props.body, showroom.cards.props.footer)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'card: optionValue',
    type: 'unknown',
    default: 'null',
    description: 'showroom.cards.props.optionValue',
  },
  {
    name: 'card: disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.cards.props.cardDisabled',
  },
  {
    name: 'group: value',
    type: 'unknown',
    default: 'null',
    description: 'showroom.cards.props.value',
  },
  {
    name: 'group: label',
    type: 'string',
    default: '—',
    description: 'showroom.cards.props.label',
  },
  {
    name: 'group: disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.cards.props.groupDisabled',
  },
  {
    name: '[ewmsCardHeader]',
    type: 'ng-content',
    default: '—',
    description: 'showroom.cards.props.header',
  },
  {
    name: '<ng-content>',
    type: 'ng-content',
    default: '—',
    description: 'showroom.cards.props.body',
  },
  {
    name: '[ewmsCardFooter]',
    type: 'ng-content',
    default: '—',
    description: 'showroom.cards.props.footer',
  },
];

/**
 * t(showroom.cards.anatomy.parts.restBackground, showroom.cards.anatomy.parts.restBorder,
 *   showroom.cards.anatomy.parts.hoverBorder, showroom.cards.anatomy.parts.chosenBackground,
 *   showroom.cards.anatomy.parts.chosenBorder, showroom.cards.anatomy.parts.disabledBackground,
 *   showroom.cards.anatomy.parts.disabledText, showroom.cards.anatomy.parts.focusRing,
 *   showroom.cards.anatomy.parts.radius, showroom.cards.anatomy.parts.elevation)
 */
const ANATOMY = [
  { part: 'showroom.cards.anatomy.parts.restBackground', token: '--color-surface' },
  { part: 'showroom.cards.anatomy.parts.restBorder', token: '--color-border' },
  { part: 'showroom.cards.anatomy.parts.hoverBorder', token: '--color-border-strong' },
  { part: 'showroom.cards.anatomy.parts.chosenBackground', token: '--color-row-selected' },
  { part: 'showroom.cards.anatomy.parts.chosenBorder', token: '--color-bg-primary' },
  { part: 'showroom.cards.anatomy.parts.disabledBackground', token: '--color-bg-secondary' },
  { part: 'showroom.cards.anatomy.parts.disabledText', token: '--color-text-disabled' },
  { part: 'showroom.cards.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
  { part: 'showroom.cards.anatomy.parts.radius', token: '--radius-md' },
  { part: 'showroom.cards.anatomy.parts.elevation', token: '--shadow-sm' },
] as const;

/**
 * Los adyacentes del hallazgo, medidos sobre --color-row-selected.
 * t(showroom.cards.finding.columns.token, showroom.cards.finding.columns.ratio,
 *   showroom.cards.finding.columns.aa)
 */
const CONTRAST_COLUMNS: readonly DocColumn[] = [
  { id: 'token', label: 'showroom.cards.finding.columns.token' },
  { id: 'ratio', label: 'showroom.cards.finding.columns.ratio' },
  { id: 'aa', label: 'showroom.cards.finding.columns.aa' },
];

/** t(showroom.cards.keyboard.columns.key, showroom.cards.keyboard.columns.does) */
const KEYBOARD_COLUMNS: readonly DocColumn[] = [
  { id: 'key', label: 'showroom.cards.keyboard.columns.key' },
  { id: 'does', label: 'showroom.cards.keyboard.columns.does' },
];

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
    DocTable,
    PropTable,
    Prose,
    StateMatrix,
    TokenValue,
    TranslocoPipe,
  ],
  templateUrl: './card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomCard {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly warehouses = WAREHOUSES;
  /** El almacén de cada celda de la matriz: un registro, no un texto de la interfaz. */
  protected readonly sample = CENTRAL;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;
  protected readonly matrixRowHeader = MATRIX_ROW_HEADER;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;
  protected readonly contrastColumns = CONTRAST_COLUMNS;
  protected readonly keyboardColumns = KEYBOARD_COLUMNS;

  protected readonly model = signal<{ almacen: string | null }>({ almacen: 'central' });
  protected readonly form = signalForm(this.model);

  protected readonly chosen = computed(() => this.form.almacen().value());

  /**
   * Lo que dice la lectura en vivo cuando el formulario tiene un valor sin card.
   * t(showroom.cards.demo.noWarehouse)
   */
  private readonly noWarehouse = translated((t) => t('showroom.cards.demo.noWarehouse'));

  /** Paradas de tabulador reales del grupo, contadas en el DOM. */
  protected readonly tabStops = signal(NOT_MEASURED);
  protected readonly cardsInGroup = signal(NOT_MEASURED);
  protected readonly isOneStop = signal(false);

  protected readonly snippet = [
    '<ewms-card-group',
    '  [formField]="alta.almacen"',
    '  [label]="\'recepciones.almacen\' | transloco"',
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
    return WAREHOUSES.find((warehouse) => warehouse.value === value)?.name ?? this.noWarehouse();
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
