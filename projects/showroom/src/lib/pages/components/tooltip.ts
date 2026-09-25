import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  Tooltip,
  type TooltipPosition,
} from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { TokenValue } from '../../ui/token-value';

interface PositionSample {
  readonly position: TooltipPosition;
  readonly label: string;
  readonly hint: string;
}

/**
 * t(showroom.tooltip.variants.top.label, showroom.tooltip.variants.top.hint,
 *   showroom.tooltip.variants.bottom.label, showroom.tooltip.variants.bottom.hint,
 *   showroom.tooltip.variants.left.label, showroom.tooltip.variants.left.hint,
 *   showroom.tooltip.variants.right.label, showroom.tooltip.variants.right.hint)
 */
const POSITIONS: readonly PositionSample[] = [
  {
    position: 'top',
    label: 'showroom.tooltip.variants.top.label',
    hint: 'showroom.tooltip.variants.top.hint',
  },
  {
    position: 'bottom',
    label: 'showroom.tooltip.variants.bottom.label',
    hint: 'showroom.tooltip.variants.bottom.hint',
  },
  {
    position: 'left',
    label: 'showroom.tooltip.variants.left.label',
    hint: 'showroom.tooltip.variants.left.hint',
  },
  {
    position: 'right',
    label: 'showroom.tooltip.variants.right.label',
    hint: 'showroom.tooltip.variants.right.hint',
  },
];

/**
 * Verificada contra tooltip.ts. La primera fila es el selector que escribe el consumidor
 * (ewmsTooltip, alias de text), no el nombre del campo.
 * t(showroom.tooltip.props.text, showroom.tooltip.props.position, showroom.tooltip.props.describes,
 *   showroom.tooltip.props.tooltipDisabled)
 */
const PROPS: readonly PropRow[] = [
  {
    name: '[ewmsTooltip]',
    type: 'string',
    default: '—',
    description: 'showroom.tooltip.props.text',
  },
  {
    name: 'position',
    type: "'top' | 'bottom' | 'left' | 'right'",
    default: "'top'",
    description: 'showroom.tooltip.props.position',
  },
  {
    name: 'describes',
    type: 'boolean',
    default: 'false',
    description: 'showroom.tooltip.props.describes',
  },
  {
    name: 'tooltipDisabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.tooltip.props.tooltipDisabled',
  },
];

/**
 * t(showroom.tooltip.anatomy.parts.background, showroom.tooltip.anatomy.parts.text,
 *   showroom.tooltip.anatomy.parts.radius, showroom.tooltip.anatomy.parts.elevation,
 *   showroom.tooltip.anatomy.parts.fontSize, showroom.tooltip.anatomy.parts.fontWeight)
 */
const ANATOMY = [
  { part: 'showroom.tooltip.anatomy.parts.background', token: '--color-neutral-solid' },
  { part: 'showroom.tooltip.anatomy.parts.text', token: '--color-text-on-primary' },
  { part: 'showroom.tooltip.anatomy.parts.radius', token: '--radius-sm' },
  { part: 'showroom.tooltip.anatomy.parts.elevation', token: '--shadow-md' },
  { part: 'showroom.tooltip.anatomy.parts.fontSize', token: '--text-caption-size' },
  { part: 'showroom.tooltip.anatomy.parts.fontWeight', token: '--text-caption-weight' },
] as const;

/**
 * t(showroom.tooltip.rules.columns.rule, showroom.tooltip.rules.columns.means,
 *   showroom.tooltip.rules.columns.check)
 */
const RULE_COLUMNS: readonly DocColumn[] = [
  { id: 'rule', label: 'showroom.tooltip.rules.columns.rule' },
  { id: 'means', label: 'showroom.tooltip.rules.columns.means' },
  { id: 'check', label: 'showroom.tooltip.rules.columns.check' },
];

/**
 * Las tres de la WCAG 1.4.13; la plantilla arma la clave con el id.
 * t(showroom.tooltip.rules.dismissible.name, showroom.tooltip.rules.dismissible.means,
 *   showroom.tooltip.rules.dismissible.check, showroom.tooltip.rules.hoverable.name,
 *   showroom.tooltip.rules.hoverable.means, showroom.tooltip.rules.hoverable.check,
 *   showroom.tooltip.rules.persistent.name, showroom.tooltip.rules.persistent.means,
 *   showroom.tooltip.rules.persistent.check)
 */
const RULES = ['dismissible', 'hoverable', 'persistent'] as const;

/**
 * /design-system/components/tooltip: ficha de ewmsTooltip. Es una directiva, no un
 * componente: cada demo la aplica sobre un anfitrión existente.
 */
@Component({
  selector: 'ewms-showroom-tooltip',
  imports: [Button, Tooltip, DemoFrame, DocTable, PropTable, Prose, TokenValue, TranslocoPipe],
  templateUrl: './tooltip.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomTooltip {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly positions = POSITIONS;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;
  protected readonly ruleColumns = RULE_COLUMNS;
  protected readonly rules = RULES;

  /** Interruptor de la demo de tooltipDisabled. */
  protected readonly suppressed = signal(false);

  protected readonly snippet = [
    '<!-- sobre un elemento cualquiera: selector prefijado -->',
    '<span',
    "  [ewmsTooltip]=\"'kpi.rotacionAyuda' | transloco\"",
    '  [describes]="true"',
    '>',
    "  {{ 'kpi.rotacion' | transloco }}",
    '</span>',
    '',
    '<!-- en el botón de solo ícono lo pone label -->',
    '<ewms-button [iconOnly]="true" variant="ghost" icon="trash" label="Eliminar" />',
  ].join('\n');

  protected toggleSuppressed(): void {
    this.suppressed.update((value) => !value);
  }
}
