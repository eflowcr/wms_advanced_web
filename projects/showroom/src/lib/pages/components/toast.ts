import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  ToastService,
  type FeedbackVariant,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { ANATOMY_COLUMNS, DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { StateMatrix, type MatrixAxis } from '../../ui/state-matrix';
import { TokenValue } from '../../ui/token-value';
import { NOT_MEASURED, rectOf, widthOf } from './measure';

interface VariantRow {
  readonly variant: FeedbackVariant;
  readonly name: string;
  readonly family: string;
  readonly message: string;
}

const VARIANTS: readonly VariantRow[] = [
  {
    variant: 'success',
    name: 'Success',
    family: 'success',
    message: 'Recepción confirmada: 12 líneas ingresadas.',
  },
  {
    variant: 'warning',
    name: 'Warning',
    family: 'warning',
    message: 'SKU-88213 quedó por debajo del mínimo.',
  },
  {
    variant: 'danger',
    name: 'Danger',
    family: 'danger',
    message: 'No se pudo cerrar la expedición EXP-0412.',
  },
  {
    variant: 'info',
    name: 'Info',
    family: 'neutral',
    message: 'Inventario cíclico en curso en el pasillo B.',
  },
];

const MATRIX_VARIANTS: readonly MatrixAxis[] = VARIANTS.map((row) => ({
  id: row.variant,
  label: row.name,
}));

const MATRIX_STATES: readonly MatrixAxis[] = [
  { id: 'family', label: 'Familia de color' },
  { id: 'accent', label: 'Acento (4 px, solid)' },
];

/** Ancho del acento que pide la ficha, en píxeles CSS. */
const ACCENT_WIDTH = 4;

/**
 * Verificada contra toast.service.ts y toast-outlet.ts. Nombres cortos a propósito:
 * con el prefijo de la clase la columna desbordaba, la tabla se volvía región con
 * scroll y axe la marcaba sin acceso por teclado. La clase va en el título.
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'show(variant, message, duration?)',
    type: '=> number',
    default: '—',
    description:
      'Encola un mensaje y devuelve su id. duration en milisegundos pisa el token para esa llamada; 0 significa «no expira».',
  },
  {
    name: 'dismiss(id)',
    type: '=> void',
    default: '—',
    description: 'Saca uno. Un id que ya no está no es un error.',
  },
  {
    name: 'dismissLatest()',
    type: '=> void',
    default: '—',
    description: 'Saca el más reciente. Es lo que hace Escape.',
  },
  {
    name: 'clear()',
    type: '=> void',
    default: '—',
    description: 'Vacía la cola, timers incluidos. Se llama sola al destruirse el inyector.',
  },
  {
    name: 'toasts',
    type: 'Signal<Toast[]>',
    default: '[]',
    description: 'Lo que la salida renderiza, del más viejo al más nuevo.',
  },
  {
    name: '[severityLabels]',
    type: 'Record<Variant, string>',
    default: '— (requerido)',
    description:
      'Entrada de la salida. Las cuatro severidades en palabras, para el nombre accesible de cada icono. Se traducen una vez, donde se monta.',
  },
  {
    name: '[regionLabel]',
    type: 'string',
    default: '— (requerido)',
    description:
      'Entrada de la salida. Nombra la región viva, para que el lector de pantalla diga de dónde viene el mensaje.',
  },
];

const ANATOMY = [
  { part: 'Fondo del toast, por familia (Success)', token: '--color-success-surface' },
  { part: 'Borde del toast, por familia (Success)', token: '--color-success-border' },
  { part: 'Texto e icono, por familia (Success)', token: '--color-success-text' },
  { part: 'Acento de 4 px (Success)', token: '--color-success-solid' },
  { part: 'Acento de 4 px (Info — neutral)', token: '--color-neutral-solid' },
  { part: 'Elevación de la pila', token: '--shadow-md' },
  { part: 'Radio del toast', token: '--radius-md' },
  { part: 'Tamaño del icono (md)', token: '--size-icon-md' },
  { part: 'Cuánto vive un mensaje', token: '--duration-toast' },
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
@Component({
  selector: 'ewms-showroom-toast',
  imports: [Button, DemoFrame, DocTable, PropTable, StateMatrix, TokenValue],
  templateUrl: './toast.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomToast {
  private readonly toastService = inject(ToastService);

  protected readonly version = DESIGN_SYSTEM_VERSION;
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

  protected raise(variant: FeedbackVariant, message: string): void {
    this.toastService.show(variant, message);
    this.measureAccent();
  }

  /** Un mensaje que hay que leer: no expira solo. */
  protected raiseSticky(): void {
    this.toastService.show(
      'danger',
      'Sin conexión con el servidor de impresión. Este no se va solo: cerralo con Escape.',
      0,
    );
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
