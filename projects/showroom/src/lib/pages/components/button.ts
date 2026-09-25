import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { Button, DESIGN_SYSTEM_VERSION, type ButtonVariant } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { ROW_SAMPLE } from './button.fixtures';

/** Cuánto dura en Loading la demo de doble envío. */
export const DEMO_LOADING_MS = 1800;

/**
 * Los nombres canónicos se leen igual en los dos idiomas, pero pasan por clave.
 * t(showroom.button.variants.names.primary, showroom.button.variants.names.secondary,
 *   showroom.button.variants.names.danger, showroom.button.variants.names.ghost,
 *   showroom.button.variants.names.link)
 */
const VARIANTS: readonly MatrixAxis[] = [
  { id: 'primary', label: 'showroom.button.variants.names.primary' },
  { id: 'secondary', label: 'showroom.button.variants.names.secondary' },
  { id: 'danger', label: 'showroom.button.variants.names.danger' },
  { id: 'ghost', label: 'showroom.button.variants.names.ghost' },
  { id: 'link', label: 'showroom.button.variants.names.link' },
];

/**
 * t(showroom.common.states.default, showroom.common.states.hover, showroom.common.states.focus,
 *   showroom.common.states.disabled, showroom.common.states.loading)
 */
const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'showroom.common.states.default' },
  { id: 'hover', label: 'showroom.common.states.hover' },
  { id: 'focus', label: 'showroom.common.states.focus' },
  { id: 'disabled', label: 'showroom.common.states.disabled' },
  { id: 'loading', label: 'showroom.common.states.loading' },
];

/** Lleva los ids de la plantilla a la unión del componente sin conversión. */
const VARIANT_BY_ID: Readonly<Record<string, ButtonVariant>> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'ghost',
  link: 'link',
};

/**
 * Estados forzados: hover y foco no se pueden congelar, así que el envoltorio aplica
 * el mismo token con más especificidad. Si buttonVariantClasses() cambia un token,
 * esto lo sigue a mano. Disabled y Loading no se fuerzan: son entradas reales.
 */
const FOCUS_RING = '[&_button]:shadow-(--focus-ring-shadow)';

const FORCED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  hover: {
    primary: '[&_button]:bg-primary-hover',
    secondary: '[&_button]:bg-secondary-hover',
    danger: '[&_button]:bg-danger-hover',
    // Ghost cambia fondo y texto en hover. Forzar solo el fondo mostró el par
    // 4.38:1 que axe detectó en el PR 3: un estado que el componente ya no tiene.
    ghost: '[&_button]:bg-ghost-hover [&_button]:text-(color:--color-bg-primary-hover)',
    link: '[&_button]:underline',
  },
  focus: {
    primary: FOCUS_RING,
    secondary: FOCUS_RING,
    danger: FOCUS_RING,
    ghost: FOCUS_RING,
    link: FOCUS_RING,
  },
};

/**
 * Verificada contra button.ts, no contra la ficha del vault: si discrepan gana el
 * código y se corrige la ficha (ver la nota sobre (click) en el bloque de contrato).
 * t(showroom.button.props.variant, showroom.button.props.size, showroom.button.props.icon,
 *   showroom.button.props.iconPosition, showroom.button.props.disabled,
 *   showroom.button.props.loading, showroom.button.props.iconOnly, showroom.button.props.label,
 *   showroom.button.props.pressedExpanded, showroom.button.props.controls,
 *   showroom.button.props.type, showroom.button.props.content)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'variant',
    type: "'primary' | 'secondary' | 'danger' | 'ghost' | 'link'",
    default: "'primary'",
    description: 'showroom.button.props.variant',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'showroom.button.props.size',
  },
  {
    name: 'icon',
    type: 'IconName | null',
    default: 'null',
    description: 'showroom.button.props.icon',
  },
  {
    name: 'iconPosition',
    type: "'left' | 'right'",
    default: "'left'",
    description: 'showroom.button.props.iconPosition',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'showroom.button.props.disabled',
  },
  {
    name: 'loading',
    type: 'boolean',
    default: 'false',
    description: 'showroom.button.props.loading',
  },
  {
    name: 'iconOnly',
    type: 'boolean',
    default: 'false',
    description: 'showroom.button.props.iconOnly',
  },
  {
    name: 'label',
    type: 'string | null',
    default: 'null',
    description: 'showroom.button.props.label',
  },
  {
    name: 'pressed / expanded',
    type: 'boolean | null',
    default: 'null',
    description: 'showroom.button.props.pressedExpanded',
  },
  {
    name: 'controls',
    type: 'string | null',
    default: 'null',
    description: 'showroom.button.props.controls',
  },
  {
    name: 'type',
    type: "'button' | 'submit'",
    default: "'button'",
    description: 'showroom.button.props.type',
  },
  {
    // El tipo es código; «texto proyectado» pasa a la descripción.
    name: '<ng-content>',
    type: '—',
    default: '—',
    description: 'showroom.button.props.content',
  },
];

/**
 * t(showroom.button.anatomy.parts.primaryBackground, showroom.button.anatomy.parts.hoverBackground,
 *   showroom.button.anatomy.parts.activeBackground, showroom.button.anatomy.parts.onPrimary,
 *   showroom.button.anatomy.parts.secondaryBackground,
 *   showroom.button.anatomy.parts.secondaryBorder, showroom.button.anatomy.parts.ghostHover,
 *   showroom.button.anatomy.parts.linkText, showroom.button.anatomy.parts.dangerBackground,
 *   showroom.button.anatomy.parts.disabledBackground, showroom.button.anatomy.parts.disabledText,
 *   showroom.button.anatomy.parts.radius, showroom.button.anatomy.parts.focusRing,
 *   showroom.button.anatomy.parts.focusRingColour, showroom.button.anatomy.parts.fontSize,
 *   showroom.button.anatomy.parts.fontWeight, showroom.button.anatomy.parts.iconMedium,
 *   showroom.button.anatomy.parts.iconSmall)
 */
const ANATOMY = [
  { part: 'showroom.button.anatomy.parts.primaryBackground', token: '--color-bg-primary' },
  { part: 'showroom.button.anatomy.parts.hoverBackground', token: '--color-bg-primary-hover' },
  { part: 'showroom.button.anatomy.parts.activeBackground', token: '--color-bg-primary-active' },
  { part: 'showroom.button.anatomy.parts.onPrimary', token: '--color-text-on-primary' },
  { part: 'showroom.button.anatomy.parts.secondaryBackground', token: '--color-bg-secondary' },
  { part: 'showroom.button.anatomy.parts.secondaryBorder', token: '--color-border-strong' },
  { part: 'showroom.button.anatomy.parts.ghostHover', token: '--color-ghost-hover' },
  { part: 'showroom.button.anatomy.parts.linkText', token: '--color-bg-primary-hover' },
  { part: 'showroom.button.anatomy.parts.dangerBackground', token: '--color-bg-danger' },
  {
    part: 'showroom.button.anatomy.parts.disabledBackground',
    token: '--color-bg-primary-disabled',
  },
  { part: 'showroom.button.anatomy.parts.disabledText', token: '--color-text-disabled' },
  { part: 'showroom.button.anatomy.parts.radius', token: '--radius-control' },
  { part: 'showroom.button.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
  { part: 'showroom.button.anatomy.parts.focusRingColour', token: '--color-focus-ring' },
  { part: 'showroom.button.anatomy.parts.fontSize', token: '--text-control-md-size' },
  { part: 'showroom.button.anatomy.parts.fontWeight', token: '--text-control-weight' },
  { part: 'showroom.button.anatomy.parts.iconMedium', token: '--size-icon-md' },
  { part: 'showroom.button.anatomy.parts.iconSmall', token: '--size-icon-sm' },
] as const;

interface SizeSample {
  readonly size: 'sm' | 'md' | 'lg';
  /** Clave del nombre del tamaño. */
  readonly label: string;
  /** Medido sobre el botón renderizado, nunca escrito a mano. */
  readonly height: string;
}

/** t(showroom.common.sizes.sm, showroom.common.sizes.md, showroom.common.sizes.lg) */
const SIZE_SAMPLES: readonly SizeSample[] = [
  { size: 'sm', label: 'showroom.common.sizes.sm', height: '…' },
  { size: 'md', label: 'showroom.common.sizes.md', height: '…' },
  { size: 'lg', label: 'showroom.common.sizes.lg', height: '…' },
];

/**
 * /design-system/components/button: la primera ficha y el molde de las demás. Tiene
 * los ocho bloques de la sección 4 de la especificación; el que no aplica lo dice.
 */
@Component({
  selector: 'ewms-showroom-button',
  imports: [Button, DemoFrame, DocTable, PropTable, Prose, StateMatrix, TokenValue, TranslocoPipe],
  templateUrl: './button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomButton {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly variants = VARIANTS;
  protected readonly states = STATES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;
  protected readonly rowSample = ROW_SAMPLE;

  protected readonly sizes = signal<readonly SizeSample[]>(SIZE_SAMPLES);
  protected readonly iconSizes = signal<readonly SizeSample[]>(SIZE_SAMPLES);

  /** Demo contra el doble envío. */
  protected readonly submitting = signal(false);
  protected readonly submitCount = signal(0);
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected readonly snippet = [
    '<ewms-button',
    '  variant="primary"',
    '  size="md"',
    '  icon="check"',
    '  [loading]="saving()"',
    '  (click)="save()"',
    '>',
    "  {{ 'articulos.guardar' | transloco }}",
    '</ewms-button>',
  ].join('\n');

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));

    // Alturas medidas sobre los botones: el bloque existe para probar 32/40/48.
    afterNextRender(() => {
      this.sizes.update((samples) => this.measure(samples, 'data-size-sample', false));
      this.iconSizes.update((samples) => this.measure(samples, 'data-icon-size-sample', true));
    });
  }

  /** Solo ícono se mide en los dos ejes: el bloque existe para probar que es cuadrado. */
  private measure(
    samples: readonly SizeSample[],
    attribute: string,
    square: boolean,
  ): SizeSample[] {
    return samples.map((sample) => {
      const box = this.host.nativeElement
        .querySelector(`[${attribute}="${sample.size}"] button`)
        ?.getBoundingClientRect();
      if (!box) {
        return { ...sample, height: '—' };
      }
      const height = `${Math.round(box.height)} px`;
      return { ...sample, height: square ? `${Math.round(box.width)} × ${height}` : height };
    });
  }

  protected variantFor(id: string): ButtonVariant {
    return VARIANT_BY_ID[id] ?? 'primary';
  }

  /** Utilidad del envoltorio que congela un estado. Ver FORCED. */
  protected forced(variant: string, state: string): string {
    return FORCED[state]?.[variant] ?? '';
  }

  /** Un clic pasa a Loading y vuelve solo; el contador prueba que un segundo clic no cuenta. */
  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.submitCount.update((count) => count + 1);
    this.timer = setTimeout(() => this.submitting.set(false), DEMO_LOADING_MS);
  }
}
