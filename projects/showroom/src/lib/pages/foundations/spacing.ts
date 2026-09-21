import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  Button,
  Checkbox,
  Input,
  Radio,
  Select,
  Toggle,
  type ButtonSize,
  type SelectOption,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { TokenReader } from '../../ui/token-reader';
import { TokenValue } from '../../ui/token-value';

/** Un paso de la escala de espaciado, al ancho que le da el multiplicador. */
interface SpacingStep {
  readonly steps: number;
  readonly utility: string;
}

interface RadiusSample {
  readonly token: string;
  readonly utility: string;
  readonly use: string;
  readonly signature: boolean;
}

interface ControlHeight {
  readonly size: ButtonSize;
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

const RADII: readonly RadiusSample[] = [
  {
    token: '--radius-sm',
    utility: 'rounded-sm',
    use: 'Chips, badges, muestras chicas.',
    signature: false,
  },
  {
    token: '--radius-control',
    utility: 'rounded-control',
    use: 'Botón, Input y Select. Los tres el mismo, siempre.',
    signature: true,
  },
  {
    token: '--radius-md',
    utility: 'rounded-md',
    use: 'Cards, paneles, marcos de demo.',
    signature: false,
  },
  { token: '--radius-lg', utility: 'rounded-lg', use: 'Modales.', signature: false },
  {
    token: '--radius-full',
    utility: 'rounded-full',
    use: 'Track y thumb del Toggle, avatares.',
    signature: false,
  },
];

const HEIGHTS: readonly ControlHeight[] = [
  { size: 'sm', label: 'Small', utility: 'h-8', padding: 'px-3' },
  { size: 'md', label: 'Medium', utility: 'h-10', padding: 'px-4' },
  { size: 'lg', label: 'Large', utility: 'h-12', padding: 'px-5' },
];

const ELEVATIONS = [
  { token: '--shadow-sm', utility: 'shadow-sm', use: 'Card en reposo.' },
  { token: '--shadow-md', utility: 'shadow-md', use: 'Dropdown, popover, Select abierto.' },
  { token: '--shadow-lg', utility: 'shadow-lg', use: 'Modal.' },
] as const;

/**
 * Un multiplicador, cinco radios, tres alturas de control y tres elevaciones. La fila mixta final
 * es el único lugar donde se ve la regla 32/40/48: Input, Select y Button reales, lado a lado.
 */
@Component({
  selector: 'ewms-showroom-spacing',
  imports: [Button, Checkbox, Input, Radio, Select, Toggle, DemoFrame, TokenValue],
  templateUrl: './spacing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSpacing {
  private readonly reader = inject(TokenReader);

  protected readonly steps = STEPS;
  protected readonly radii = RADII;
  protected readonly heights = HEIGHTS;
  protected readonly elevations = ELEVATIONS;

  protected readonly options: readonly SelectOption[] = [
    { value: 'a', label: 'Almacén central' },
    { value: 'b', label: 'Muelle 3' },
    { value: 'c', label: 'Cuarentena' },
  ];

  /** Multiplicador base leído en vivo; todo número de abajo se deriva de él. */
  protected readonly base = signal('…');

  constructor() {
    afterNextRender(() => this.base.set(this.reader.value('--spacing-base') || '—'));
  }
}
