import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { Button, DESIGN_SYSTEM_VERSION, IconButton, type ButtonVariant } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';

/** How long the anti-double-submit demo stays in Loading. */
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

/** Keeps the template's string ids in the component's own union, with no cast. */
const VARIANT_BY_ID: Readonly<Record<string, ButtonVariant>> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'ghost',
};

/**
 * The forced states of the matrix.
 *
 * `:hover` and `:focus-visible` cannot be held still, so each cell gets the
 * SAME token its own rule would have applied, through an arbitrary variant on
 * the wrapper. The wrapper's selector is one step more specific than the
 * button's own utility, so it wins without anything being marked important.
 *
 * This mapping is the one thing on the page that can silently drift from the
 * component: if buttonVariantClasses() ever changes which token a hover uses,
 * this has to follow. It lives here, next to the demo, rather than inside the
 * matrix widget, precisely so a reviewer comparing the two has them on the
 * same screen.
 *
 * Disabled and Loading are NOT forced: they are real inputs, so the matrix
 * passes them to the real component and what renders is the real behaviour.
 */
const FOCUS_RING = '[&_button]:shadow-(--focus-ring-shadow)';

const FORCED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  hover: {
    primary: '[&_button]:bg-primary-hover',
    secondary: '[&_button]:bg-secondary-hover',
    danger: '[&_button]:bg-danger-hover',
    /*
     * Two utilities, because Ghost's hover changes two things: the ground
     * AND the text. Forcing only the background is what rendered the 4.38:1
     * pair that axe caught in PR 3 -- the cell was showing a state the
     * component no longer has.
     */
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
 * The property table.
 *
 * VERIFIED AGAINST button.ts, NOT AGAINST THE VAULT SHEET. Where the two
 * disagree the code wins and the sheet is what gets corrected — see the note
 * in the contract block about `(click)`.
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
  /** Measured off the rendered button, never written down. */
  readonly height: string;
}

/**
 * /design-system/components/button — the first component sheet, and the
 * template the other nine are written against.
 *
 * The eight blocks of section 4 of the showroom spec are all here, in order.
 * A block that does not apply says so rather than disappearing: the visible
 * hole is information.
 */
@Component({
  selector: 'ewms-showroom-button',
  // No Tooltip here: ewms-icon-button applies the directive itself, and
  // importing it again only tells the compiler about a directive this template
  // never writes.
  imports: [Button, IconButton, DemoFrame, PropTable, StateMatrix, TokenValue],
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

  protected readonly sizes = signal<readonly SizeSample[]>([
    { size: 'sm', label: 'Small', height: '…' },
    { size: 'md', label: 'Medium', height: '…' },
    { size: 'lg', label: 'Large', height: '…' },
  ]);

  /** The anti-double-submit demo. */
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

    // The heights are measured off the rendered buttons rather than written
    // into the page: the block exists to prove 32/40/48, and a number typed
    // here would prove nothing.
    afterNextRender(() => {
      this.sizes.update((samples) =>
        samples.map((sample) => {
          const element = this.host.nativeElement.querySelector(
            `[data-size-sample="${sample.size}"] button`,
          );
          const height = element?.getBoundingClientRect().height;
          return { ...sample, height: height === undefined ? '—' : `${Math.round(height)} px` };
        }),
      );
    });
  }

  protected variantFor(id: string): ButtonVariant {
    return VARIANT_BY_ID[id] ?? 'primary';
  }

  /** The wrapper utility that holds a state still. See FORCED. */
  protected forced(variant: string, state: string): string {
    return FORCED[state]?.[variant] ?? '';
  }

  /**
   * The demo of the pattern: one click, Loading, and back on its own. A second
   * click while it is loading must not increase the counter — that is the
   * whole point of the pattern, and the counter is how you see it.
   */
  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.submitCount.update((count) => count + 1);
    this.timer = setTimeout(() => this.submitting.set(false), DEMO_LOADING_MS);
  }
}
