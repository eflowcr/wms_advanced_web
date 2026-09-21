import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { Banner, DESIGN_SYSTEM_VERSION, type FeedbackVariant } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { formatBox, rectOf } from './measure';

/**
 * Variantes con su familia de color y su rol. La tabla de la página sale de acá y no
 * puede afirmar un par que la demo no renderiza.
 */
interface VariantRow {
  readonly variant: FeedbackVariant;
  readonly name: string;
  readonly family: string;
  readonly role: string;
  readonly severityLabel: string;
  readonly title: string;
  readonly description: string;
}

const VARIANTS: readonly VariantRow[] = [
  {
    variant: 'success',
    name: 'Success',
    family: 'success',
    role: 'status',
    severityLabel: 'Éxito',
    title: 'Recepción confirmada',
    description: 'Las 12 líneas de la OC-2026-0418 quedaron ingresadas.',
  },
  {
    variant: 'warning',
    name: 'Warning',
    family: 'warning',
    role: 'alert',
    severityLabel: 'Advertencia',
    title: 'Stock por debajo del mínimo',
    description: 'SKU-88213 quedó en 4 unidades; el mínimo de reposición es 25.',
  },
  {
    variant: 'danger',
    name: 'Danger',
    family: 'danger',
    role: 'alert',
    severityLabel: 'Error',
    title: 'No se pudo cerrar la expedición',
    description: 'Tres series de la línea 4 no están asignadas a ningún bulto.',
  },
  {
    variant: 'info',
    name: 'Info',
    family: 'neutral',
    role: 'status',
    severityLabel: 'Información',
    title: 'Inventario cíclico en curso',
    description: 'El pasillo B está bloqueado para movimientos hasta las 14:00.',
  },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = VARIANTS.map((row) => ({
  id: row.variant,
  label: row.name,
}));

const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'full', label: 'Con descripción' },
  { id: 'title-only', label: 'Sólo título' },
  { id: 'dismissible', label: 'Con cerrar' },
];

/** Tamaño de icono que fija el componente, en píxeles CSS (md). */
const ICON_SIZE = 18;

/** Verificada contra banner.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'variant',
    type: "'success' | 'warning' | 'danger' | 'info'",
    default: "'info'",
    description:
      'La severidad. Elige el icono, la familia de color y el role. Info se llama Info y se pinta neutral: no existe familia info.',
  },
  {
    name: 'title',
    type: 'string',
    default: '— (requerido)',
    description: 'El titular, ya traducido por el consumidor. El sistema de diseño no habla ningún idioma.',
  },
  {
    name: 'description',
    type: 'string',
    default: "''",
    description: 'Segunda línea opcional. Un banner de una sola línea es un banner legítimo.',
  },
  {
    name: 'severityLabel',
    type: 'string',
    default: '— (requerido)',
    description:
      'La severidad en palabras, para el nombre accesible del icono. Requerido en el tipo: es la única pista que no depende de ver el color.',
  },
  {
    name: 'dismissible',
    type: 'boolean',
    default: 'false',
    description: 'Muestra el botón de cerrar. Sin esto no hay botón, y no hay forma de cerrarlo.',
  },
  {
    name: 'dismissLabel',
    type: 'string',
    default: "''",
    description:
      'Nombre accesible del botón de cerrar. Con default en vez de requerido: un banner sin botón no debería pagar ese impuesto.',
  },
  {
    name: '(dismiss)',
    type: 'OutputEmitterRef<void>',
    default: '—',
    description:
      'Se emite al pulsar cerrar. NO se llama (close): close es nativo en window y en <dialog>. El banner no se saca solo de la pantalla.',
  },
];

const ANATOMY = [
  { part: 'Fondo, por familia (Success)', token: '--color-success-surface' },
  { part: 'Borde, por familia (Success)', token: '--color-success-border' },
  { part: 'Texto e icono, por familia (Success)', token: '--color-success-text' },
  { part: 'Fondo de Info — neutral, nunca azul', token: '--color-neutral-surface' },
  { part: 'Texto e icono de Info', token: '--color-neutral-text' },
  { part: 'Radio de la caja', token: '--radius-md' },
  { part: 'Tamaño del icono (md)', token: '--size-icon-md' },
  { part: 'Trazo del icono a ese tamaño', token: '--stroke-icon-md' },
  { part: 'Título', token: '--text-h4-size' },
  { part: 'Descripción', token: '--text-p-size' },
] as const;

interface IconSample {
  readonly variant: FeedbackVariant;
  readonly name: string;
  readonly box: string;
  readonly isMd: boolean;
}

/**
 * /design-system/components/banner: ficha de ewms-banner. Abre con lo que sorprende:
 * Info se pinta neutral, porque el azul significa «esto se hace clic».
 */
@Component({
  selector: 'ewms-showroom-banner',
  imports: [Banner, DemoFrame, PropTable, StateMatrix, TokenValue],
  templateUrl: './banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomBanner {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly variants = VARIANTS;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;

  /** Lo cuenta la demo, para mostrar que «no se saca solo». */
  protected readonly dismissCount = signal(0);

  protected readonly iconSamples = signal<readonly IconSample[]>(
    VARIANTS.map((row) => ({ variant: row.variant, name: row.name, box: '…', isMd: false })),
  );

  protected readonly snippet = [
    '<ewms-banner',
    '  variant="warning"',
    "  [title]=\"'recepciones.stockBajo.titulo' | transloco\"",
    "  [description]=\"'recepciones.stockBajo.detalle' | transloco\"",
    "  [severityLabel]=\"'comun.severidad.advertencia' | transloco\"",
    '  [dismissible]="true"',
    "  [dismissLabel]=\"'comun.cerrar' | transloco\"",
    '  (dismiss)="ocultarAviso()"',
    '/>',
  ].join('\n');

  constructor() {
    // El icono mide 18 px (md) en las cuatro variantes; se mide el SVG porque alguien
    // querrá agrandarlo según la severidad.
    afterNextRender(() => {
      this.iconSamples.update((samples) =>
        samples.map((sample) => {
          const rect = rectOf(this.host.nativeElement, `[data-icon-sample="${sample.variant}"] svg`);
          return {
            ...sample,
            box: formatBox(rect),
            isMd: rect !== null && Math.round(rect.width) === ICON_SIZE,
          };
        }),
      );
    });
  }

  protected variantFor(id: string): FeedbackVariant {
    return (VARIANTS.find((row) => row.variant === id)?.variant ?? 'info') as FeedbackVariant;
  }

  protected rowFor(id: string): VariantRow {
    return VARIANTS.find((row) => row.variant === id) ?? VARIANTS[3]!;
  }

  protected descriptionFor(stateId: string, id: string): string {
    return stateId === 'title-only' ? '' : this.rowFor(id).description;
  }

  protected isDismissible(stateId: string): boolean {
    return stateId === 'dismissible';
  }

  protected onDismiss(): void {
    this.dismissCount.update((count) => count + 1);
  }
}
