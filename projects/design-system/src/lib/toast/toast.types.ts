import type { FeedbackVariant } from '../feedback/feedback.types';

/**
 * Un mensaje de la cola, como lo recibe el outlet. El `id` lo genera el servicio y
 * nunca un consumidor: dos pantallas que inventaran «1» se descartarían los
 * mensajes entre ellas.
 */
export interface Toast {
  readonly id: number;
  readonly variant: FeedbackVariant;
  /** Ya traducido por quien llamó a `show` (ADR 0008). */
  readonly message: string;
}

/** El token del que el servicio saca su duración por defecto. */
export const TOAST_DURATION_TOKEN = '--duration-toast';

/**
 * La pila flotante. ABAJO A LA DERECHA, y la ficha no lo dice -dice «flotante»-:
 * reportado como hallazgo, porque dónde va la pila es una decisión de diseño. Es
 * la esquina más lejos de lo que lee un operario y la que no tapa la cabecera.
 * `z-10` la pone sobre el contenido y BAJO el contenedor de overlays del CDK, así
 * que un toast levantado con un diálogo abierto queda detrás: es deliberado, el
 * diálogo es modal y un mensaje flotando encima invita al clic que el modal evita.
 */
export const TOAST_OUTLET_CLASSES =
  'fixed right-4 bottom-4 z-10 flex flex-col items-end gap-2 pointer-events-none';

/**
 * Un toast: superficie blanca, elevación de popover y una barra de 4 px en el
 * solid de la familia. `pointer-events-auto` deshace el `none` del contenedor, que
 * abarca una esquina del viewport y no puede tragarse clics de la página de abajo.
 */
export const TOAST_CLASSES =
  'pointer-events-auto flex max-w-96 items-stretch overflow-hidden rounded-md border shadow-md';

/**
 * La parte con relleno, dentro del acento. El relleno va acá y NO en el toast, para
 * que la barra de 4 px llegue arriba y abajo: en la caja de afuera, `self-stretch`
 * estira al hijo hasta la caja de contenido -que excluye el relleno- y el acento
 * salía metido doce píxeles en cada punta.
 */
export const TOAST_BODY_CLASSES = 'flex min-w-0 items-center gap-2 px-4 py-3';
