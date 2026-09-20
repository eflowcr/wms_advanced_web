import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { DESIGN_SYSTEM_VERSION, IconButton, type ButtonVariant } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { clearsSquare, formatBox, rectOf } from './measure';

const VARIANTS: readonly MatrixAxis[] = [
  { id: 'primary', label: 'Primary' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'danger', label: 'Danger' },
  { id: 'ghost', label: 'Ghost (default)' },
];

const STATES: readonly MatrixAxis[] = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'focus', label: 'Focus' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'loading', label: 'Loading' },
];

const VARIANT_BY_ID: Readonly<Record<string, ButtonVariant>> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'ghost',
};

/**
 * The forced states, identical in shape to the Button page's -- which is the
 * point: the two components share button.types.ts, so a cell here that needed
 * a DIFFERENT utility would mean they had drifted.
 *
 * Disabled and Loading are NOT forced. They are real inputs and are passed to
 * the real component, which matters for more than honesty: forcing `disabled`
 * with a class would leave axe looking at an ENABLED control painted in the
 * disabled palette, and the 1.38:1 of disabled text -- which WCAG exempts --
 * would be reported as a contrast failure on a control that does not have one.
 */
const FOCUS_RING = '[&_button]:shadow-(--focus-ring-shadow)';

const FORCED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  hover: {
    primary: '[&_button]:bg-primary-hover',
    secondary: '[&_button]:bg-secondary-hover',
    danger: '[&_button]:bg-danger-hover',
    // Ghost darkens its text as well as its ground. See button.types.ts.
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
 * VERIFIED AGAINST icon-button.ts. Three of these are required in the type,
 * and that is the component's whole argument -- so the column says so rather
 * than printing a default nobody can rely on.
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'icon',
    type: 'IconName',
    default: '— (requerido)',
    description:
      'Nombre del catálogo cerrado de 71 iconos. Uno fuera de la lista no compila. Va aria-hidden: el nombre lo da label.',
  },
  {
    name: 'label',
    type: 'string',
    default: '— (requerido)',
    description:
      'El nombre accesible, ya traducido. Requerido EN EL TIPO, sin excepción: sin texto visible no hay nombre, y un default vaciaría la garantía.',
  },
  {
    name: 'tooltip',
    type: 'string',
    default: '— (requerido)',
    description:
      'El texto al hover y al foco, ya traducido. No se deriva de label, para no cerrar el caso en que deben decir cosas distintas.',
  },
  {
    name: 'variant',
    type: "'primary' | 'secondary' | 'danger' | 'ghost'",
    default: "'ghost'",
    description:
      'Default ghost, no primary: este control vive en filas y toolbars, donde el énfasis correcto es el más bajo.',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'Cuadrado: 32, 40 o 48 px de lado. Las mismas tres alturas de control del sistema.',
  },
  {
    name: 'disabled',
    type: 'boolean',
    default: 'false',
    description: 'Atributo nativo disabled. Independiente de loading.',
  },
  {
    name: 'loading',
    type: 'boolean',
    default: 'false',
    description:
      'Mismo patrón que el Botón: aria-busy, aria-disabled, la caja no cambia de tamaño y el click se ignora.',
  },
];

const ANATOMY = [
  // One token, two roles: the Primary ground and the Ghost glyph are the same
  // blue, which is exactly why Ghost has no text utility of its own.
  { part: 'Fondo de Primary, e icono de Ghost en default', token: '--color-bg-primary' },
  { part: 'Fondo de Primary en hover, e icono de Ghost en hover', token: '--color-bg-primary-hover' },
  { part: 'Fondo de Ghost en hover', token: '--color-ghost-hover' },
  { part: 'Icono sobre Primary y Danger', token: '--color-text-on-primary' },
  { part: 'Fondo, variante Secondary', token: '--color-bg-secondary' },
  { part: 'Borde, variante Secondary', token: '--color-border-strong' },
  { part: 'Fondo, variante Danger', token: '--color-bg-danger' },
  { part: 'Fondo deshabilitado (Primary)', token: '--color-bg-primary-disabled' },
  { part: 'Icono deshabilitado', token: '--color-text-disabled' },
  { part: 'Radio de esquina', token: '--radius-control' },
  { part: 'Anillo de foco (las dos bandas)', token: '--focus-ring-shadow' },
  { part: 'Color del anillo', token: '--color-focus-ring' },
  { part: 'Icono en Medium y Large', token: '--size-icon-md' },
  { part: 'Icono en Small', token: '--size-icon-sm' },
] as const;

interface SizeSample {
  readonly size: 'sm' | 'md' | 'lg';
  readonly label: string;
  /** Measured off the rendered button. `width x height`, never written down. */
  readonly box: string;
  /** Whether the measured box clears the 24x24 of WCAG 2.2 2.5.8. */
  readonly clearsTarget: boolean;
}

/** WCAG 2.2 2.5.8 (Target Size, Minimum, AA), in CSS pixels. */
const MINIMUM_TARGET = 24;

/**
 * /design-system/components/icon-button -- the sheet of `ewms-icon-button`.
 *
 * The demo has to show the REAL case and not a button with a glyph in it: no
 * visible text, a `label` for whoever cannot see it and a `tooltip` for
 * whoever can. Those two are what the component is, so they are what the page
 * leads with.
 */
@Component({
  selector: 'ewms-showroom-icon-button',
  // No Tooltip import: the component applies the directive itself, and
  // declaring it again would tell the compiler about a directive this template
  // never writes.
  imports: [IconButton, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './icon-button.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomIconButton {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly variants = VARIANTS;
  protected readonly states = STATES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly minimumTarget = MINIMUM_TARGET;

  protected readonly sizes = signal<readonly SizeSample[]>([
    { size: 'sm', label: 'Small', box: '…', clearsTarget: false },
    { size: 'md', label: 'Medium', box: '…', clearsTarget: false },
    { size: 'lg', label: 'Large', box: '…', clearsTarget: false },
  ]);

  protected readonly snippet = [
    '<!-- label Y tooltip: dos públicos, dos textos, los dos obligatorios -->',
    '<ewms-icon-button',
    '  icon="trash"',
    "  [label]=\"'articulos.eliminar' | transloco\"",
    "  [tooltip]=\"'articulos.eliminarAviso' | transloco\"",
    '  variant="danger"',
    '  (click)="eliminar(fila)"',
    '/>',
  ].join('\n');

  constructor() {
    /*
     * Square is a claim, and 2.5.8 is a threshold: both are measured off the
     * rendered control. A page that printed "32 x 32" would go on printing it
     * after the box stopped being square.
     */
    afterNextRender(() => {
      this.sizes.update((samples) =>
        samples.map((sample) => {
          const rect = rectOf(
            this.host.nativeElement,
            `[data-size-sample="${sample.size}"] button`,
          );
          return {
            ...sample,
            box: formatBox(rect),
            clearsTarget: clearsSquare(rect, MINIMUM_TARGET),
          };
        }),
      );
    });
  }

  protected variantFor(id: string): ButtonVariant {
    return VARIANT_BY_ID[id] ?? 'ghost';
  }

  /** The wrapper utility that holds a state still. See FORCED. */
  protected forced(variant: string, state: string): string {
    return FORCED[state]?.[variant] ?? '';
  }
}
