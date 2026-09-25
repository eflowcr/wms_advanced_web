import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  Button,
  Checkbox,
  Input,
  Radio,
  RadioGroup,
  Select,
  Toggle,
  type ButtonSize,
  type SelectOption,
} from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { Prose } from '../../ui/prose';
import { TokenReader } from '../../ui/token-reader';
import { TokenValue } from '../../ui/token-value';
import { LOCATION_OPTIONS } from './spacing.fixtures';

/** Un paso de la escala de espaciado, al ancho que le da el multiplicador. */
interface SpacingStep {
  readonly steps: number;
  readonly utility: string;
}

interface RadiusSample {
  readonly token: string;
  readonly utility: string;
  /** Clave del diccionario. */
  readonly use: string;
  readonly signature: boolean;
}

interface ControlHeight {
  readonly size: ButtonSize;
  /** Clave del diccionario. */
  readonly label: string;
  readonly utility: string;
  readonly padding: string;
}

const STEPS: readonly SpacingStep[] = [
  { steps: 1, utility: 'w-1' },
  { steps: 2, utility: 'w-2' },
  { steps: 3, utility: 'w-3' },
  { steps: 4, utility: 'w-4' },
  { steps: 5, utility: 'w-5' },
  { steps: 6, utility: 'w-6' },
  { steps: 8, utility: 'w-8' },
  { steps: 10, utility: 'w-10' },
  { steps: 12, utility: 'w-12' },
  { steps: 16, utility: 'w-16' },
  { steps: 20, utility: 'w-20' },
  { steps: 24, utility: 'w-24' },
];

/**
 * t(showroom.spacing.radii.uses.sm, showroom.spacing.radii.uses.control,
 *   showroom.spacing.radii.uses.md, showroom.spacing.radii.uses.lg,
 *   showroom.spacing.radii.uses.full)
 */
const RADII: readonly RadiusSample[] = [
  {
    token: '--radius-sm',
    utility: 'rounded-sm',
    use: 'showroom.spacing.radii.uses.sm',
    signature: false,
  },
  {
    token: '--radius-control',
    utility: 'rounded-control',
    use: 'showroom.spacing.radii.uses.control',
    signature: true,
  },
  {
    token: '--radius-md',
    utility: 'rounded-md',
    use: 'showroom.spacing.radii.uses.md',
    signature: false,
  },
  {
    token: '--radius-lg',
    utility: 'rounded-lg',
    use: 'showroom.spacing.radii.uses.lg',
    signature: false,
  },
  {
    token: '--radius-full',
    utility: 'rounded-full',
    use: 'showroom.spacing.radii.uses.full',
    signature: false,
  },
];

/** t(showroom.common.sizes.sm, showroom.common.sizes.md, showroom.common.sizes.lg) */
const HEIGHTS: readonly ControlHeight[] = [
  { size: 'sm', label: 'showroom.common.sizes.sm', utility: 'h-8', padding: 'px-3' },
  { size: 'md', label: 'showroom.common.sizes.md', utility: 'h-10', padding: 'px-4' },
  { size: 'lg', label: 'showroom.common.sizes.lg', utility: 'h-12', padding: 'px-5' },
];

/**
 * t(showroom.spacing.elevation.uses.sm, showroom.spacing.elevation.uses.md,
 *   showroom.spacing.elevation.uses.lg)
 */
const ELEVATIONS = [
  { token: '--shadow-sm', utility: 'shadow-sm', use: 'showroom.spacing.elevation.uses.sm' },
  { token: '--shadow-md', utility: 'shadow-md', use: 'showroom.spacing.elevation.uses.md' },
  { token: '--shadow-lg', utility: 'shadow-lg', use: 'showroom.spacing.elevation.uses.lg' },
] as const;

/**
 * Un multiplicador, cinco radios, tres alturas de control y tres elevaciones. La fila mixta final
 * es el único lugar donde se ve la regla 32/40/48: Input, Select y Button reales, lado a lado.
 */
@Component({
  selector: 'ewms-showroom-spacing',
  imports: [
    Button,
    Checkbox,
    Input,
    Radio,
    RadioGroup,
    Select,
    Toggle,
    DemoFrame,
    Prose,
    TokenValue,
    TranslocoPipe,
  ],
  templateUrl: './spacing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSpacing {
  private readonly reader = inject(TokenReader);

  protected readonly steps = STEPS;
  protected readonly radii = RADII;
  protected readonly heights = HEIGHTS;
  protected readonly elevations = ELEVATIONS;

  protected readonly options: readonly SelectOption[] = LOCATION_OPTIONS;

  /** Multiplicador base leído en vivo; todo número de abajo se deriva de él. */
  protected readonly base = signal('…');

  constructor() {
    afterNextRender(() => this.base.set(this.reader.value('--spacing-base') || '—'));
  }
}
