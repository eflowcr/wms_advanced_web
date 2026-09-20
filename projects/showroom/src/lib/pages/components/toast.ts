import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  ToastService,
  type FeedbackVariant,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
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

/** The accent the sheet asks for, in CSS pixels. */
const ACCENT_WIDTH = 4;

/**
 * VERIFIED AGAINST toast.service.ts AND toast-outlet.ts.
 *
 * THE NAMES ARE SHORT ON PURPOSE, and the reason is a real failure rather
 * than taste. Written out in full (`ToastService.dismissLatest()`), the first
 * column's longest word cannot be broken, so the table grew past its column
 * and `overflow-x-auto` turned into a scrolling region. Chrome then makes a
 * scrollable region a tab stop of its own, and axe reports the region as one
 * without keyboard access -- two failures, one cause, neither of them about
 * the toast. The class name goes in the caption, where it is said once.
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
 * The matrix's cells, WRITTEN OUT IN FULL rather than built from the family
 * name.
 *
 * Tailwind scans raw text: a class assembled as `bg-${family}-solid` is a
 * string it never sees, so the rule it needs may or may not be in the bundle
 * depending on whether some other file happens to spell it. Every class this
 * page paints with is therefore a literal, which is also what makes gate 10
 * able to judge it.
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
 * /design-system/components/toast -- the sheet of `ToastService` and
 * `ewms-toast-outlet`.
 *
 * THE DEMO NO ES UN SIMULACRO. The buttons call the real `ToastService`, and
 * the messages appear in the SHELL's outlet -- the only one in the document.
 * There is deliberately no second outlet on this page: two `aria-live` regions
 * would announce every message twice, which is the exact failure the
 * single-region rule exists to prevent.
 */
@Component({
  selector: 'ewms-showroom-toast',
  imports: [Button, DemoFrame, PropTable, StateMatrix, TokenValue],
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

  /** How many are up right now, read off the real queue. */
  protected readonly queued = this.toastService.toasts;

  /** The accent's measured width, read off the rendered stack. */
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

  /** A message that has to be read: it never expires on its own. */
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
   * The 4 px accent, measured off the rendered stack rather than printed.
   *
   * It reads from `document` and not from this component's host, because the
   * toasts render in the SHELL's outlet -- outside this page's tree. That is
   * not a workaround: it is the single-outlet rule showing through, and
   * measuring anywhere else would be measuring a replica.
   *
   * The read is deferred one turn so the outlet has rendered the message this
   * click just queued.
   */
  private measureAccent(): void {
    setTimeout(() => {
      const rect = rectOf(document, '[role="status"][aria-live] > div > span');
      this.accentWidth.set(rect === null ? NOT_MEASURED : `${widthOf(rect)} px`);
      this.accentIsFour.set(rect !== null && widthOf(rect) === ACCENT_WIDTH);
    });
  }

  /**
   * The matrix cells are STATIC SAMPLES of the two token roles, not live
   * toasts, and that is the honest way to draw this grid: a toast lives in one
   * floating stack in a corner of the viewport, so eight of them cannot be
   * held still inside a table. What the table shows is the pair of tokens each
   * variant uses, drawn with those tokens.
   */
  protected cellClasses(stateId: string, variantId: string): string {
    const sample = stateId === 'accent' ? ACCENT_SAMPLES : SURFACE_SAMPLES;
    return sample[variantId] ?? '';
  }
}
