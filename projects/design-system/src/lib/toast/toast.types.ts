import type { FeedbackVariant } from '../feedback/feedback.types';

/** El `id` lo genera el servicio: dos pantallas que inventaran «1» se borrarían los mensajes. */
export interface Toast {
  readonly id: number;
  readonly variant: FeedbackVariant;
  /** Ya traducido (ADR 0008). */
  readonly message: string;
}

export const TOAST_DURATION_TOKEN = '--duration-toast';

/** Abajo a la derecha, bajo los overlays: detrás de un modal a propósito. Ver vault: Notificaciones. */
export const TOAST_OUTLET_CLASSES =
  'fixed right-4 bottom-4 z-10 flex flex-col items-end gap-2 pointer-events-none';

/** Reactiva el puntero que el contenedor apaga para no tragarse clics de la página. */
export const TOAST_CLASSES =
  'pointer-events-auto flex max-w-96 items-stretch overflow-hidden rounded-md border shadow-md';

/** El relleno va acá: afuera, la barra de acento quedaba doce píxeles corta en cada punta. */
export const TOAST_BODY_CLASSES = 'flex min-w-0 items-center gap-2 px-4 py-3';
