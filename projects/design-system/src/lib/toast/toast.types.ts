import type { FeedbackVariant } from '../feedback/feedback.types';

/** El `id` lo genera el servicio: dos pantallas que inventaran «1» se borrarían los mensajes. */
export interface Toast {
  readonly id: number;
  readonly variant: FeedbackVariant;
  /** Ya traducido (ADR 0008). */
  readonly message: string;
}

export const TOAST_DURATION_TOKEN = '--duration-toast';

/** Los que se ven a la vez: el cuarto saca al más viejo (decisión del usuario, 2026-09-26). */
export const TOAST_LIMIT = 3;

/** Bajo los overlays: detrás de un modal a propósito. Ver vault: Notificaciones. */
export const TOAST_OUTLET_CLASSES =
  'fixed right-4 z-(--layer-overlay) flex flex-col items-end gap-2 pointer-events-none';

/** Desde el corte de la barra inferior: abajo a la derecha. */
export const TOAST_OUTLET_WIDE_CLASSES = 'bottom-4';

/** Bajo el corte: encima de la barra inferior, y con los dos bordes para no salirse de 375 px. */
export const TOAST_OUTLET_COMPACT_CLASSES = 'left-4 bottom-(--toast-bottom-compact)';

/** Reactiva el puntero que el contenedor apaga para no tragarse clics de la página. */
export const TOAST_CLASSES =
  'pointer-events-auto flex max-w-96 items-stretch overflow-hidden rounded-md border shadow-md';

/** El relleno va acá: afuera, la barra de acento quedaba doce píxeles corta en cada punta. */
export const TOAST_BODY_CLASSES = 'flex min-w-0 items-center gap-2 px-4 py-3';
