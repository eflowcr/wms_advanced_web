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
 * Mismos estados forzados que Button: comparten button.types.ts. Disabled y Loading
 * van como entradas reales; forzar disabled con una clase haría que axe reportara
 * el 1.38:1 (exento en WCAG) como falla de contraste de un control habilitado.
 */
const FOCUS_RING = '[&_button]:shadow-(--focus-ring-shadow)';

const FORCED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  hover: {
    primary: '[&_button]:bg-primary-hover',
    secondary: '[&_button]:bg-secondary-hover',
    danger: '[&_button]:bg-danger-hover',
    // Ghost oscurece el texto además del fondo. Ver button.types.ts.
    ghost: '[&_button]:bg-ghost-hover [&_button]:text-(color:--color-bg-primary-hover)',
  },
  focus: {
    primary: FOCUS_RING,
    secondary: FOCUS_RING,
    danger: FOCUS_RING,
    ghost: FOCUS_RING,
  },
};

/** Verificada contra icon-button.ts. Tres entradas son requeridas y la columna lo dice. */
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
  // Un token, dos roles: el fondo de Primary y el glifo de Ghost son el mismo azul,
  // por eso Ghost no tiene utilidad de texto propia.
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
  /** Ancho x alto medido sobre el botón renderizado. */
  readonly box: string;
  /** Si la caja medida cumple el 24x24 de WCAG 2.2 2.5.8. */
  readonly clearsTarget: boolean;
}

/** WCAG 2.2 2.5.8 (tamaño mínimo de objetivo, AA), en píxeles CSS. */
const MINIMUM_TARGET = 24;

/**
 * /design-system/components/icon-button: ficha de ewms-icon-button. La demo muestra el
 * caso real: sin texto visible, con label para quien no ve y tooltip para quien sí.
 */
@Component({
  selector: 'ewms-showroom-icon-button',
  // Sin Tooltip: el componente ya aplica la directiva y esta plantilla no la escribe.
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
    // Que sea cuadrado y que cumpla 2.5.8 se mide sobre el control renderizado.
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

  /** Utilidad del envoltorio que congela un estado. Ver FORCED. */
  protected forced(variant: string, state: string): string {
    return FORCED[state]?.[variant] ?? '';
  }
}
