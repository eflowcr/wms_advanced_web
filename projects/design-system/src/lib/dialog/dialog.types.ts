/**
 * Los tres tonos de una confirmación. `info` es el nombre y `neutral` el color,
 * como en Banner y Toast: el registro de Figma pintaba Info azul y lo reemplazó
 * la regla de marca -el azul es «acá se hace clic»-. La ficha Modal lo corrige
 * en su encabezado.
 */
export type DialogTone = 'danger' | 'warning' | 'info';

/** Lo que toma `DialogService.confirm`. Todo texto ya traducido (ADR 0008). */
export interface ConfirmOptions {
  readonly title: string;
  readonly body: string;
  readonly tone: DialogTone;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

/**
 * Lo que recibe el componente de confirmación: las opciones más los dos ids que
 * acuñó el servicio. Interno: los ids tienen que estar en la config del CDK
 * ANTES de abrir, así que no se pueden generar dentro del componente que los usa.
 */
export interface ConfirmDialogData extends ConfirmOptions {
  readonly titleId: string;
  readonly bodyId: string;
}

/**
 * Si el fondo puede descartar este diálogo. FRICCIÓN DELIBERADA, de la ficha: una
 * confirmación destructiva no cierra al hacer clic afuera, porque un clic al
 * pasar es el gesto más barato que hay y el diálogo existe para que la respuesta
 * destructiva cueste más que la segura.
 * Escape cierra las tres, siempre: es una tecla deliberada y la salida documentada
 * de un modal, y tragarla sería una trampa de teclado disfrazada de fricción
 * (WCAG 2.1.2).
 */
export function backdropDismisses(tone: DialogTone): boolean {
  return tone !== 'danger';
}

/**
 * La zona del icono: un círculo de 56 px en la superficie del tono, con aro y
 * halo, Y SIN GLIFO ADENTRO. Es una excepción que la ficha documenta, no una
 * pieza que falte: la forma con halo se validó con el usuario el 27/08, y meterle
 * un glifo es una decisión que alguien tiene que tomar. El halo vive en tokens.css
 * como `--shadow-halo-*`.
 */
export function dialogIconClasses(tone: DialogTone): string {
  switch (tone) {
    case 'danger':
      return 'bg-danger-surface border-danger shadow-(--shadow-halo-danger)';
    case 'warning':
      return 'bg-warning-surface border-warning shadow-(--shadow-halo-warning)';
    case 'info':
      return 'bg-neutral-surface border-neutral shadow-(--shadow-halo-neutral)';
  }
}

/**
 * La variante del botón de confirmar: Danger para una respuesta destructiva,
 * Primary para el resto, como ya hacían las variantes de Figma. Cancelar siempre
 * es Secondary.
 */
export function confirmButtonVariant(tone: DialogTone): 'danger' | 'primary' {
  return tone === 'danger' ? 'danger' : 'primary';
}

/**
 * La caja. `--radius-dialog` y `--shadow-dialog` son geometría propia del Modal,
 * el único componente del sistema que la tiene: la escala de elevación termina
 * en el modal y este es el nivel que pide una tercera capa.
 *
 * El ancho sale de la escala de 4 px (120 x 4 = 480 px) y NO de la escala de
 * contenedores por defecto de Tailwind, que ADR 0009 borra: una de esas utilidades
 * compila, no aplica nada y solo la compuerta 10 lo nota. Su nombre no se escribe
 * en ningún lado de este archivo, comentarios incluidos: la compuerta lee toda
 * tirada entre comillas de un .ts como posible clase, y un par de acentos graves
 * en un comentario es una tirada entre comillas. Así rompió el build la primera
 * vez que se escribió esta nota.
 */
export const DIALOG_BOX_CLASSES =
  'flex w-full max-w-120 flex-col items-center gap-4 bg-surface p-6 text-center ' +
  'rounded-dialog shadow-dialog border border-default border-solid';

/**
 * El fondo: navy al 50 % con el desenfoque que pide la ficha. Navy y no negro,
 * como toda capa del sistema: el negro apaga la escena, el navy la tiñe de marca.
 */
export const DIALOG_BACKDROP_CLASSES = ['bg-overlay', 'backdrop-blur-dialog'];

/** El panel. La caja lleva el aspecto; el panel solo tiene que no estorbar. */
export const DIALOG_PANEL_CLASSES = ['flex', 'max-w-full', 'p-4'];
