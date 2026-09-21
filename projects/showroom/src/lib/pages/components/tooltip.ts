import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  Tooltip,
  type TooltipPosition,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { TokenValue } from '../../ui/token-value';

interface PositionSample {
  readonly position: TooltipPosition;
  readonly label: string;
  readonly hint: string;
}

const POSITIONS: readonly PositionSample[] = [
  { position: 'top', label: 'top (default)', hint: 'Arriba; cae abajo si no entra.' },
  { position: 'bottom', label: 'bottom', hint: 'Abajo; sube si no entra.' },
  { position: 'left', label: 'left', hint: 'A la izquierda; pasa a la derecha si no entra.' },
  { position: 'right', label: 'right', hint: 'A la derecha; pasa a la izquierda si no entra.' },
];

/**
 * Verificada contra tooltip.ts. La primera fila es el selector que escribe el consumidor
 * (ewmsTooltip, alias de text), no el nombre del campo.
 */
const PROPS: readonly PropRow[] = [
  {
    name: '[ewmsTooltip]',
    type: 'string',
    default: '— (requerido)',
    description:
      'El texto, ya traducido por el consumidor. Es el selector Y la entrada: aplicar la directiva y darle su texto son el mismo atributo. Dentro de un componente del DS se expone como tooltip, a secas.',
  },
  {
    name: 'position',
    type: "'top' | 'bottom' | 'left' | 'right'",
    default: "'top'",
    description:
      'Colocación preferida. Se voltea sola a la opuesta cuando no entra: la lista que recorre el CDK tiene dos entradas, la pedida y su contraria.',
  },
  {
    name: 'describes',
    type: 'boolean',
    default: 'false',
    description:
      'Si el texto AGREGA información al nombre accesible. false conecta nada y pone el panel aria-hidden; true lo conecta con aria-describedby y role="tooltip". La directiva no adivina: lo declara quien la usa.',
  },
  {
    name: 'tooltipDisabled',
    type: 'boolean',
    default: 'false',
    description:
      'Suprime el tooltip en un contexto puntual sin quitar la directiva. NO se llama disabled, y el prefijo es estructural: ver Errores comunes.',
  },
];

const ANATOMY = [
  { part: 'Fondo del panel', token: '--color-neutral-solid' },
  { part: 'Texto del panel', token: '--color-text-on-primary' },
  { part: 'Radio de esquina', token: '--radius-sm' },
  { part: 'Elevación', token: '--shadow-md' },
  { part: 'Tamaño de letra', token: '--text-caption-size' },
  { part: 'Peso de letra', token: '--text-caption-weight' },
] as const;

/**
 * /design-system/components/tooltip: ficha de ewmsTooltip. Es una directiva, no un
 * componente: cada demo la aplica sobre un anfitrión existente.
 */
@Component({
  selector: 'ewms-showroom-tooltip',
  imports: [Button, Tooltip, DemoFrame, PropTable, TokenValue],
  templateUrl: './tooltip.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomTooltip {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly positions = POSITIONS;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;

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
