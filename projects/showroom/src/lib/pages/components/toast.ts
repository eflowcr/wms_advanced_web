import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  ToastService,
  type FeedbackVariant,
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { NOT_MEASURED, rectOf, widthOf } from './measure';

interface VariantRow {
  readonly variant: FeedbackVariant;
  readonly name: string;
  readonly family: string;
  readonly message: string;
}

/**
 * `name` y `message` son claves: la tabla las traduce con el pipe, y el mensaje se traduce al
 * levantar el toast, en el idioma de ese momento.
 * t(showroom.toast.variants.success.name, showroom.toast.variants.success.message,
 *   showroom.toast.variants.warning.name, showroom.toast.variants.warning.message,
 *   showroom.toast.variants.danger.name, showroom.toast.variants.danger.message,
 *   showroom.toast.variants.info.name, showroom.toast.variants.info.message)
 */
const VARIANTS: readonly VariantRow[] = [
  {
    variant: 'success',
    name: 'showroom.toast.variants.success.name',
    family: 'success',
    message: 'showroom.toast.variants.success.message',
  },
  {
    variant: 'warning',
    name: 'showroom.toast.variants.warning.name',
    family: 'warning',
    message: 'showroom.toast.variants.warning.message',
  },
  {
    variant: 'danger',
    name: 'showroom.toast.variants.danger.name',
    family: 'danger',
    message: 'showroom.toast.variants.danger.message',
  },
  {
    variant: 'info',
    name: 'showroom.toast.variants.info.name',
    family: 'neutral',
    message: 'showroom.toast.variants.info.message',
  },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = VARIANTS.map((row) => ({
  id: row.variant,
  label: row.name,
}));

/** t(showroom.toast.states.columns.family, showroom.toast.states.columns.accent) */
const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'family', label: 'showroom.toast.states.columns.family' },
  { id: 'accent', label: 'showroom.toast.states.columns.accent' },
];

/**
 * El aviso que no vence solo. Clave en constante y marcador, no el literal en translate().
 * t(showroom.toast.demo.stickyMessage)
 */
const STICKY_MESSAGE = 'showroom.toast.demo.stickyMessage';

/** Ancho del acento que pide la ficha, en píxeles CSS. */
const ACCENT_WIDTH = 4;

/**
 * Verificada contra toast.service.ts y toast-outlet.ts. Nombres cortos a propósito:
 * con el prefijo de la clase la columna desbordaba, la tabla se volvía región con
 * scroll y axe la marcaba sin acceso por teclado. La clase va en el título.
 * t(showroom.toast.props.show, showroom.toast.props.dismiss, showroom.toast.props.dismissLatest,
 *   showroom.toast.props.clear, showroom.toast.props.toasts, showroom.toast.props.severityLabels,
 *   showroom.toast.props.regionLabel)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'show(variant, message, duration?)',
    type: '=> number',
    default: '—',
    description: 'showroom.toast.props.show',
  },
  {
    name: 'dismiss(id)',
    type: '=> void',
    default: '—',
    description: 'showroom.toast.props.dismiss',
  },
  {
    name: 'dismissLatest()',
    type: '=> void',
    default: '—',
    description: 'showroom.toast.props.dismissLatest',
  },
  {
    name: 'clear()',
    type: '=> void',
    default: '—',
    description: 'showroom.toast.props.clear',
  },
  {
    name: 'toasts',
    type: 'Signal<Toast[]>',
    default: '[]',
    description: 'showroom.toast.props.toasts',
  },
  {
    name: '[severityLabels]',
    type: 'Record<Variant, string>',
    default: '—',
    description: 'showroom.toast.props.severityLabels',
  },
  {
    name: '[regionLabel]',
    type: 'string',
    default: '—',
    description: 'showroom.toast.props.regionLabel',
  },
];

/**
 * t(showroom.toast.anatomy.parts.surface, showroom.toast.anatomy.parts.border,
 *   showroom.toast.anatomy.parts.text, showroom.toast.anatomy.parts.accent,
 *   showroom.toast.anatomy.parts.accentInfo, showroom.toast.anatomy.parts.elevation,
 *   showroom.toast.anatomy.parts.radius, showroom.toast.anatomy.parts.iconSize,
 *   showroom.toast.anatomy.parts.duration)
 */
const ANATOMY = [
  { part: 'showroom.toast.anatomy.parts.surface', token: '--color-success-surface' },
  { part: 'showroom.toast.anatomy.parts.border', token: '--color-success-border' },
  { part: 'showroom.toast.anatomy.parts.text', token: '--color-success-text' },
  { part: 'showroom.toast.anatomy.parts.accent', token: '--color-success-solid' },
  { part: 'showroom.toast.anatomy.parts.accentInfo', token: '--color-neutral-solid' },
  { part: 'showroom.toast.anatomy.parts.elevation', token: '--shadow-md' },
  { part: 'showroom.toast.anatomy.parts.radius', token: '--radius-md' },
  { part: 'showroom.toast.anatomy.parts.iconSize', token: '--size-icon-md' },
  { part: 'showroom.toast.anatomy.parts.duration', token: '--duration-toast' },
] as const;

/**
 * Celdas escritas completas, no armadas con la familia: Tailwind escanea texto
 * crudo y no ve una clase interpolada. Como literales, la compuerta 10 las juzga.
 */
const SURFACE_SAMPLES: Readonly<Record<string, string>> = {
  success: 'h-6 w-16 rounded-sm border bg-success-surface border-success',
  warning: 'h-6 w-16 rounded-sm border bg-warning-surface border-warning',
  danger: 'h-6 w-16 rounded-sm border bg-danger-surface border-danger',
  info: 'h-6 w-16 rounded-sm border bg-neutral-surface border-neutral',
};

const ACCENT_SAMPLES: Readonly<Record<string, string>> = {
  success: 'h-6 w-6 rounded-sm bg-success-solid',
  warning: 'h-6 w-6 rounded-sm bg-warning-solid',
  danger: 'h-6 w-6 rounded-sm bg-danger-solid',
  info: 'h-6 w-6 rounded-sm bg-neutral-solid',
};

/**
 * /design-system/components/toast: ficha de ToastService y ewms-toast-outlet. La demo
 * usa el servicio real y los mensajes salen en la salida del shell; una segunda
 * región aria-live acá anunciaría todo dos veces.
 */
/**
 * t(showroom.toast.variants.columns.name,
 *   showroom.toast.variants.columns.family,
 *   showroom.toast.variants.columns.message)
 */
const VARIANT_COLUMNS: readonly DocColumn[] = [
  { id: 'name', label: 'showroom.toast.variants.columns.name' },
  { id: 'family', label: 'showroom.toast.variants.columns.family' },
  { id: 'message', label: 'showroom.toast.variants.columns.message' },
];

/**
 * t(showroom.toast.sizes.duration.columns.token,
 *   showroom.toast.sizes.duration.columns.value)
 */
const DURATION_COLUMNS: readonly DocColumn[] = [
  { id: 'token', label: 'showroom.toast.sizes.duration.columns.token' },
  { id: 'value', label: 'showroom.toast.sizes.duration.columns.value' },
];

@Component({
  selector: 'ewms-showroom-toast',
  imports: [Button, DemoFrame, DocTable, PropTable, Prose, StateMatrix, TokenValue, TranslocoPipe],
  templateUrl: './toast.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomToast {
  private readonly toastService = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly variantColumns = VARIANT_COLUMNS;
  protected readonly durationColumns = DURATION_COLUMNS;
  protected readonly variants = VARIANTS;
  protected readonly matrixVariants = MATRIX_VARIANTS;
  protected readonly matrixStates = MATRIX_STATES;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly anatomyColumns = ANATOMY_COLUMNS;

  /** Cuántos hay visibles, leído de la cola real. */
  protected readonly queued = this.toastService.toasts;

  /** Ancho medido del acento en la pila renderizada. */
  protected readonly accentWidth = signal('…');
  protected readonly accentIsFour = signal(false);

  protected readonly snippet = [
    'private readonly toasts = inject(ToastService);',
    '',
    'async guardar(): Promise<void> {',
    '  await this.recepciones.confirmar(this.orden());',
    '  this.toasts.show(',
    "    'success',",
    "    this.transloco.translate('recepciones.confirmada'),",
    '  );',
    '}',
  ].join('\n');

  /** El servicio recibe texto, no claves: se traduce acá, como haría una pantalla. */
  protected raise(variant: FeedbackVariant, messageKey: string): void {
    this.toastService.show(variant, this.transloco.translate(messageKey));
    this.measureAccent();
  }

  /** Un mensaje que hay que leer: no expira solo. */
  protected raiseSticky(): void {
    this.toastService.show('danger', this.transloco.translate(STICKY_MESSAGE), 0);
    this.measureAccent();
  }

  protected clear(): void {
    this.toastService.clear();
  }

  /**
   * Mide el acento de 4 px en document, no en el host: los toasts viven en la salida
   * del shell. Se difiere un turno para que la salida ya haya pintado el mensaje.
   */
  private measureAccent(): void {
    setTimeout(() => {
      const rect = rectOf(document, '[role="status"][aria-live] > div > span');
      this.accentWidth.set(rect === null ? NOT_MEASURED : `${widthOf(rect)} px`);
      this.accentIsFour.set(rect !== null && widthOf(rect) === ACCENT_WIDTH);
    });
  }

  /**
   * Muestras estáticas de los dos tokens de cada variante, no toasts vivos: un toast
   * vive en una pila flotante y no se puede fijar dentro de una tabla.
   */
  protected cellClasses(stateId: string, variantId: string): string {
    const sample = stateId === 'accent' ? ACCENT_SAMPLES : SURFACE_SAMPLES;
    return sample[variantId] ?? '';
  }
}
