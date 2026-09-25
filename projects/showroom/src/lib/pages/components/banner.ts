import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { Banner, DESIGN_SYSTEM_VERSION, type FeedbackVariant } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { formatBox, rectOf } from './measure';

/**
 * Variantes con su familia de color y su rol. La tabla de la página sale de acá y no
 * puede afirmar un par que la demo no renderiza. `name`, `severityLabel`, `title` y
 * `description` son claves: las traduce la plantilla con el pipe.
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

/**
 * t(showroom.banner.variants.success.name, showroom.banner.variants.success.severity,
 *   showroom.banner.variants.success.title, showroom.banner.variants.success.description,
 *   showroom.banner.variants.warning.name, showroom.banner.variants.warning.severity,
 *   showroom.banner.variants.warning.title, showroom.banner.variants.warning.description,
 *   showroom.banner.variants.danger.name, showroom.banner.variants.danger.severity,
 *   showroom.banner.variants.danger.title, showroom.banner.variants.danger.description,
 *   showroom.banner.variants.info.name, showroom.banner.variants.info.severity,
 *   showroom.banner.variants.info.title, showroom.banner.variants.info.description)
 */
const VARIANTS: readonly VariantRow[] = [
  {
    variant: 'success',
    name: 'showroom.banner.variants.success.name',
    family: 'success',
    role: 'status',
    severityLabel: 'showroom.banner.variants.success.severity',
    title: 'showroom.banner.variants.success.title',
    description: 'showroom.banner.variants.success.description',
  },
  {
    variant: 'warning',
    name: 'showroom.banner.variants.warning.name',
    family: 'warning',
    role: 'alert',
    severityLabel: 'showroom.banner.variants.warning.severity',
    title: 'showroom.banner.variants.warning.title',
    description: 'showroom.banner.variants.warning.description',
  },
  {
    variant: 'danger',
    name: 'showroom.banner.variants.danger.name',
    family: 'danger',
    role: 'alert',
    severityLabel: 'showroom.banner.variants.danger.severity',
    title: 'showroom.banner.variants.danger.title',
    description: 'showroom.banner.variants.danger.description',
  },
  {
    variant: 'info',
    name: 'showroom.banner.variants.info.name',
    family: 'neutral',
    role: 'status',
    severityLabel: 'showroom.banner.variants.info.severity',
    title: 'showroom.banner.variants.info.title',
    description: 'showroom.banner.variants.info.description',
  },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = VARIANTS.map((row) => ({
  id: row.variant,
  label: row.name,
}));

/**
 * t(showroom.banner.states.columns.full, showroom.banner.states.columns.titleOnly,
 *   showroom.banner.states.columns.dismissible)
 */
const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'full', label: 'showroom.banner.states.columns.full' },
  { id: 'title-only', label: 'showroom.banner.states.columns.titleOnly' },
  { id: 'dismissible', label: 'showroom.banner.states.columns.dismissible' },
];

/** Tamaño de icono que fija el componente, en píxeles CSS (md). */
const ICON_SIZE = 18;

/**
 * Verificada contra banner.ts.
 * t(showroom.banner.props.variant, showroom.banner.props.title, showroom.banner.props.description,
 *   showroom.banner.props.severityLabel, showroom.banner.props.dismissible,
 *   showroom.banner.props.dismissLabel, showroom.banner.props.dismiss)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'variant',
    type: "'success' | 'warning' | 'danger' | 'info'",
    default: "'info'",
    description: 'showroom.banner.props.variant',
  },
  {
    name: 'title',
    type: 'string',
    default: '—',
    description: 'showroom.banner.props.title',
  },
  {
    name: 'description',
    type: 'string',
    default: "''",
    description: 'showroom.banner.props.description',
  },
  {
    name: 'severityLabel',
    type: 'string',
    default: '—',
    description: 'showroom.banner.props.severityLabel',
  },
  {
    name: 'dismissible',
    type: 'boolean',
    default: 'false',
    description: 'showroom.banner.props.dismissible',
  },
  {
    name: 'dismissLabel',
    type: 'string',
    default: "''",
    description: 'showroom.banner.props.dismissLabel',
  },
  {
    name: '(dismiss)',
    type: 'OutputEmitterRef<void>',
    default: '—',
    description: 'showroom.banner.props.dismiss',
  },
];

/**
 * t(showroom.banner.anatomy.parts.surface, showroom.banner.anatomy.parts.border,
 *   showroom.banner.anatomy.parts.text, showroom.banner.anatomy.parts.infoSurface,
 *   showroom.banner.anatomy.parts.infoText, showroom.banner.anatomy.parts.radius,
 *   showroom.banner.anatomy.parts.iconSize, showroom.banner.anatomy.parts.iconStroke,
 *   showroom.banner.anatomy.parts.title, showroom.banner.anatomy.parts.description)
 */
const ANATOMY = [
  { part: 'showroom.banner.anatomy.parts.surface', token: '--color-success-surface' },
  { part: 'showroom.banner.anatomy.parts.border', token: '--color-success-border' },
  { part: 'showroom.banner.anatomy.parts.text', token: '--color-success-text' },
  { part: 'showroom.banner.anatomy.parts.infoSurface', token: '--color-neutral-surface' },
  { part: 'showroom.banner.anatomy.parts.infoText', token: '--color-neutral-text' },
  { part: 'showroom.banner.anatomy.parts.radius', token: '--radius-md' },
  { part: 'showroom.banner.anatomy.parts.iconSize', token: '--size-icon-md' },
  { part: 'showroom.banner.anatomy.parts.iconStroke', token: '--stroke-icon-md' },
  { part: 'showroom.banner.anatomy.parts.title', token: '--text-h4-size' },
  { part: 'showroom.banner.anatomy.parts.description', token: '--text-p-size' },
] as const;

interface IconSample {
  readonly variant: FeedbackVariant;
  /** Clave del nombre de la variante. */
  readonly name: string;
  readonly box: string;
  readonly isMd: boolean;
}

/**
 * /design-system/components/banner: ficha de ewms-banner. Abre con lo que sorprende:
 * Info se pinta neutral, porque el azul significa «esto se hace clic».
 */
/**
 * t(showroom.banner.variants.columns.name,
 *   showroom.banner.variants.columns.family,
 *   showroom.banner.variants.columns.role,
 *   showroom.banner.variants.columns.icon)
 */
const VARIANT_COLUMNS: readonly DocColumn[] = [
  { id: 'name', label: 'showroom.banner.variants.columns.name' },
  { id: 'family', label: 'showroom.banner.variants.columns.family' },
  { id: 'role', label: 'showroom.banner.variants.columns.role' },
  { id: 'icon', label: 'showroom.banner.variants.columns.icon' },
];

/**
 * t(showroom.banner.anatomy.iconToken.columns.family,
 *   showroom.banner.anatomy.iconToken.columns.text,
 *   showroom.banner.anatomy.iconToken.columns.solid)
 */
const ICON_TOKEN_COLUMNS: readonly DocColumn[] = [
  { id: 'family', label: 'showroom.banner.anatomy.iconToken.columns.family' },
  { id: 'text', label: 'showroom.banner.anatomy.iconToken.columns.text' },
  { id: 'solid', label: 'showroom.banner.anatomy.iconToken.columns.solid' },
];

@Component({
  selector: 'ewms-showroom-banner',
  imports: [Banner, DemoFrame, DocTable, PropTable, Prose, StateMatrix, TokenValue, TranslocoPipe],
  templateUrl: './banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomBanner {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly variantColumns = VARIANT_COLUMNS;
  protected readonly iconTokenColumns = ICON_TOKEN_COLUMNS;
  protected readonly variants = VARIANTS;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;

  /** Lo cuenta la demo, para mostrar que «no se saca solo». */
  protected readonly dismissCount = signal(0);

  protected readonly iconSamples = signal<readonly IconSample[]>(
    VARIANTS.map((row) => ({ variant: row.variant, name: row.name, box: '…', isMd: false })),
  );

  protected readonly snippet = [
    '<ewms-banner',
    '  variant="warning"',
    '  [title]="\'recepciones.stockBajo.titulo\' | transloco"',
    '  [description]="\'recepciones.stockBajo.detalle\' | transloco"',
    '  [severityLabel]="\'comun.severidad.advertencia\' | transloco"',
    '  [dismissible]="true"',
    '  [dismissLabel]="\'comun.cerrar\' | transloco"',
    '  (dismiss)="ocultarAviso()"',
    '/>',
  ].join('\n');

  constructor() {
    // El icono mide 18 px (md) en las cuatro variantes; se mide el SVG porque alguien
    // querrá agrandarlo según la severidad.
    afterNextRender(() => {
      this.iconSamples.update((samples) =>
        samples.map((sample) => {
          const rect = rectOf(
            this.host.nativeElement,
            `[data-icon-sample="${sample.variant}"] svg`,
          );
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

  /** Clave de la descripción, o vacío en la columna «Sólo título» (el pipe deja pasar el vacío). */
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
