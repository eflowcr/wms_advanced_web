import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Text, type TextVariant } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { TokenValue } from '../../ui/token-value';

/**
 * One step of the scale.
 *
 * `lineHeight` and `weight` may name a token that does not exist. That is not
 * an oversight in this page: tokens.css records three line-heights and the
 * mono weight as undecided, and the row stays with the gap visible rather than
 * disappearing or being filled in with a guess.
 */
interface ScaleStep {
  readonly variant: TextVariant;
  readonly label: string;
  readonly sample: string;
  readonly use: string;
  readonly size: string;
  readonly weight: string;
  readonly lineHeight: string;
  /** Tokens this step knowingly does not have. */
  readonly pending: readonly string[];
}

const SCALE: readonly ScaleStep[] = [
  {
    variant: 'h1',
    label: 'H1',
    sample: 'Recepción de mercancía',
    use: 'Título de página. Uno por pantalla.',
    size: '--text-h1-size',
    weight: '--text-h1-weight',
    lineHeight: '--text-h1-line-height',
    pending: [],
  },
  {
    variant: 'h2',
    label: 'H2',
    sample: 'Órdenes pendientes',
    use: 'Título de sección.',
    size: '--text-h2-size',
    weight: '--text-h2-weight',
    lineHeight: '--text-h2-line-height',
    pending: [],
  },
  {
    variant: 'h3',
    label: 'H3',
    sample: 'Detalle del bulto',
    use: 'Subsección, o encabezado de una card.',
    size: '--text-h3-size',
    weight: '--text-h3-weight',
    lineHeight: '--text-h3-line-height',
    pending: [],
  },
  {
    variant: 'h4',
    label: 'H4',
    sample: 'Ubicación',
    use: 'Etiqueta destacada. La mayúscula la aplica el componente, no el texto.',
    size: '--text-h4-size',
    weight: '--text-h4-weight',
    lineHeight: '--text-h4-line-height',
    pending: ['--text-h4-line-height'],
  },
  {
    variant: 'p',
    label: 'P',
    sample: 'El operario confirma la cantidad recibida antes de cerrar la recepción.',
    use: 'Cuerpo de texto.',
    size: '--text-p-size',
    weight: '--text-p-weight',
    lineHeight: '--text-p-line-height',
    pending: [],
  },
  {
    variant: 'caption',
    label: 'Caption',
    sample: 'Actualizado hace 3 minutos',
    use: 'Metadatos y timestamps. Lleva color secundario.',
    size: '--text-caption-size',
    weight: '--text-caption-weight',
    lineHeight: '--text-caption-line-height',
    pending: ['--text-caption-line-height'],
  },
  {
    variant: 'mono',
    label: 'Mono',
    sample: 'SKU-48812-A / LOTE 2026-09',
    use: 'Códigos, SKU, lotes, IDs.',
    size: '--text-mono-size',
    weight: '--text-mono-weight',
    lineHeight: '--text-mono-line-height',
    pending: ['--text-mono-weight', '--text-mono-line-height'],
  },
];

/**
 * /design-system/foundations/typography — the scale, rendered at its real size.
 *
 * The samples go through the real `ewms-text`, so what is on screen is the
 * component and not a copy of its styles. Sizes, weights and line-heights are
 * read live; the four values tokens.css leaves undecided are shown as the gaps
 * they are.
 */
@Component({
  selector: 'ewms-showroom-typography',
  imports: [Text, DemoFrame, TokenValue],
  templateUrl: './typography.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomTypography {
  protected readonly scale = SCALE;

  protected isPending(step: ScaleStep, token: string): boolean {
    return step.pending.includes(token);
  }
}
