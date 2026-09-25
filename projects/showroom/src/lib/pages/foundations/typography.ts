import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Text, type TextVariant } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { Prose } from '../../ui/prose';
import { TokenValue } from '../../ui/token-value';

/**
 * Un paso de la escala. `lineHeight` y `weight` pueden nombrar un token inexistente: tokens.css
 * deja sin decidir tres interlineados y el peso mono, y la fila muestra el hueco sin adivinar.
 * `sample` y `use` son claves del diccionario; `label` es el nombre de la variante, sin traducir.
 */
interface ScaleStep {
  readonly variant: TextVariant;
  readonly label: string;
  readonly sample: string;
  readonly use: string;
  readonly size: string;
  readonly weight: string;
  readonly lineHeight: string;
  /** Tokens que este paso no tiene, a sabiendas. */
  readonly pending: readonly string[];
}

/**
 * t(showroom.typography.scale.h1.sample, showroom.typography.scale.h1.use,
 *   showroom.typography.scale.h2.sample, showroom.typography.scale.h2.use,
 *   showroom.typography.scale.h3.sample, showroom.typography.scale.h3.use,
 *   showroom.typography.scale.h4.sample, showroom.typography.scale.h4.use,
 *   showroom.typography.scale.p.sample, showroom.typography.scale.p.use,
 *   showroom.typography.scale.caption.sample, showroom.typography.scale.caption.use,
 *   showroom.typography.scale.mono.sample, showroom.typography.scale.mono.use)
 */
const SCALE: readonly ScaleStep[] = [
  {
    variant: 'h1',
    label: 'H1',
    sample: 'showroom.typography.scale.h1.sample',
    use: 'showroom.typography.scale.h1.use',
    size: '--text-h1-size',
    weight: '--text-h1-weight',
    lineHeight: '--text-h1-line-height',
    pending: [],
  },
  {
    variant: 'h2',
    label: 'H2',
    sample: 'showroom.typography.scale.h2.sample',
    use: 'showroom.typography.scale.h2.use',
    size: '--text-h2-size',
    weight: '--text-h2-weight',
    lineHeight: '--text-h2-line-height',
    pending: [],
  },
  {
    variant: 'h3',
    label: 'H3',
    sample: 'showroom.typography.scale.h3.sample',
    use: 'showroom.typography.scale.h3.use',
    size: '--text-h3-size',
    weight: '--text-h3-weight',
    lineHeight: '--text-h3-line-height',
    pending: [],
  },
  {
    variant: 'h4',
    label: 'H4',
    sample: 'showroom.typography.scale.h4.sample',
    use: 'showroom.typography.scale.h4.use',
    size: '--text-h4-size',
    weight: '--text-h4-weight',
    lineHeight: '--text-h4-line-height',
    pending: ['--text-h4-line-height'],
  },
  {
    variant: 'p',
    label: 'P',
    sample: 'showroom.typography.scale.p.sample',
    use: 'showroom.typography.scale.p.use',
    size: '--text-p-size',
    weight: '--text-p-weight',
    lineHeight: '--text-p-line-height',
    pending: [],
  },
  {
    variant: 'caption',
    label: 'Caption',
    sample: 'showroom.typography.scale.caption.sample',
    use: 'showroom.typography.scale.caption.use',
    size: '--text-caption-size',
    weight: '--text-caption-weight',
    lineHeight: '--text-caption-line-height',
    pending: ['--text-caption-line-height'],
  },
  {
    variant: 'mono',
    label: 'Mono',
    sample: 'showroom.typography.scale.mono.sample',
    use: 'showroom.typography.scale.mono.use',
    size: '--text-mono-size',
    weight: '--text-mono-weight',
    lineHeight: '--text-mono-line-height',
    pending: ['--text-mono-weight', '--text-mono-line-height'],
  },
];

/**
 * La escala tipográfica a tamaño real, a través del `ewms-text` real. Tamaños, pesos e
 * interlineados se leen en vivo; los cuatro valores sin decidir se muestran como huecos.
 */
@Component({
  selector: 'ewms-showroom-typography',
  imports: [Text, DemoFrame, Prose, TokenValue, TranslocoPipe],
  templateUrl: './typography.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomTypography {
  protected readonly scale = SCALE;

  protected isPending(step: ScaleStep, token: string): boolean {
    return step.pending.includes(token);
  }
}
