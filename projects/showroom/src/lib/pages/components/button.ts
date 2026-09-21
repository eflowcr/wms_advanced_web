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
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';

/** Cuánto dura en Loading la demo de doble envío. */
export const DEMO_LOADING_MS = 1800;

const VARIANTS: readonly MatrixAxis[] = [
  { id: 'primary', label: 'Primary' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'danger', label: 'Danger' },
  { id: 'ghost', label: 'Ghost' },
];

const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'focus', label: 'Focus' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'loading', label: 'Loading' },
];

/** Lleva los ids de la plantilla a la unión del componente sin conversión. */
const VARIANT_BY_ID: Readonly<Record<string, ButtonVariant>> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'ghost',
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
  },
  focus: {
    primary: FOCUS_RING,
    secondary: FOCUS_RING,
    danger: FOCUS_RING,
    ghost: FOCUS_RING,
  },
};

/**
 * Verificada contra button.ts, no contra la ficha del vault: si discrepan gana el
 * código y se corrige la ficha (ver la nota sobre (click) en el bloque de contrato).
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'variant',
    type: "'primary' | 'secondary' | 'danger' | 'ghost'",
    default: "'primary'",
    description: 'El énfasis. Una sola Primary por vista o formulario.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'Las tres alturas de control, compartidas con Input y Select.',
  },
  {
    name: 'icon',
    type: 'IconName | null',
    default: 'null',
    description:
      'Nombre del catálogo cerrado. Un nombre fuera de la lista no compila. Se renderiza sin label: es decorativo, el texto del botón ya lo dice.',
  },
  {
    name: 'iconPosition',
    type: "'left' | 'right'",
    default: "'left'",
    description: 'Sólo aplica si hay icono.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Independiente de loading. Usa el atributo nativo disabled.',
  },
  {
    name: 'loading',
    type: 'boolean',
    default: 'false',
    description:
      'Oculta el contenido sin cambiar el tamaño, pone aria-busy y aria-disabled, e ignora el click. No usa el disabled nativo, para no perder el foco.',
  },
  {
    name: 'iconOnly',
    type: 'boolean',
    default: 'false',
    description: 'Sin texto visible: caja cuadrada, y label pasa a ser el nombre y el tooltip.',
  },
  {
    name: 'label',
    type: 'string | null',
    default: 'null',
    description: 'Obligatoria con iconOnly (error en modo desarrollo). Llega traducida.',
  },
  {
    name: 'pressed / expanded',
    type: 'boolean | null',
    default: 'null',
    description: 'aria-pressed y aria-expanded. Null los deja fuera: no es un conmutador.',
  },
  {
    name: 'controls',
    type: 'string | null',
    default: 'null',
    description: 'aria-controls: el id del panel o menú que abre.',
  },
  {
    name: 'type',
    type: "'button' | 'submit'",
    default: "'button'",
    description:
      'Con submit, dentro de un <form>, Enter en cualquier campo envía. El default no cambia nada de lo que ya existía: un botón sólo envía si alguien lo escribió a propósito.',
  },
  {
    name: '<ng-content>',
    type: 'texto proyectado',
    default: '—',
    description:
      'El texto del botón. Llega traducido desde el consumidor: el sistema no habla ningún idioma.',
  },
];

const ANATOMY = [
  { part: 'Fondo, variante Primary', token: '--color-bg-primary' },
  { part: 'Fondo en hover', token: '--color-bg-primary-hover' },
  { part: 'Fondo en active', token: '--color-bg-primary-active' },
  { part: 'Texto e icono sobre Primary y Danger', token: '--color-text-on-primary' },
  { part: 'Fondo, variante Secondary', token: '--color-bg-secondary' },
  { part: 'Borde, variante Secondary', token: '--color-border-strong' },
  { part: 'Fondo de Ghost en hover', token: '--color-ghost-hover' },
  { part: 'Fondo, variante Danger', token: '--color-bg-danger' },
  { part: 'Fondo deshabilitado (Primary)', token: '--color-bg-primary-disabled' },
  { part: 'Texto deshabilitado', token: '--color-text-disabled' },
  { part: 'Radio de esquina', token: '--radius-control' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
  { part: 'Color del anillo', token: '--color-focus-ring' },
  { part: 'Tipografía, tamaño Medium', token: '--text-control-md-size' },
  { part: 'Tipografía, peso', token: '--text-control-weight' },
  { part: 'Icono en Medium y Large', token: '--size-icon-md' },
  { part: 'Icono en Small', token: '--size-icon-sm' },
] as const;

interface SizeSample {
  readonly size: 'sm' | 'md' | 'lg';
  readonly label: string;
  /** Medido sobre el botón renderizado, nunca escrito a mano. */
  readonly height: string;
}

const SIZE_SAMPLES: readonly SizeSample[] = [
  { size: 'sm', label: 'Small', height: '…' },
  { size: 'md', label: 'Medium', height: '…' },
  { size: 'lg', label: 'Large', height: '…' },
];

/**
 * /design-system/components/button: la primera ficha y el molde de las demás. Tiene
 * los ocho bloques de la sección 4 de la especificación; el que no aplica lo dice.
 */
@Component({
  selector: 'ewms-showroom-button',
  imports: [Button, DemoFrame, PropTable, StateMatrix, TokenValue],
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
  private measure(samples: readonly SizeSample[], attribute: string, square: boolean): SizeSample[] {
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
