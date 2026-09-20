import { BUTTON_FONT_SIZES, BUTTON_HEIGHT_CLASSES, type ButtonSize } from '../button/button.types';
import type { IconSize } from '../icon/icon';

/**
 * Lo que Input y Select comparten: mismas alturas, escala tipográfica, radio,
 * colores de borde y anillo de foco. Una fila con un campo, un select y un botón
 * se alinea porque ninguno de los tres es dueño de esos números.
 * Las alturas y la escala NO se redefinen acá: son las del Botón, importadas.
 */

export type FieldSize = ButtonSize;

/** `error` es PURAMENTE VISUAL: ninguno de los dos valida, decide el formulario. */
export type FieldState = 'default' | 'error' | 'disabled' | 'readonly';

/** 32 / 40 / 48. La escala del Botón, no una segunda copia. */
export const FIELD_HEIGHT_CLASSES = BUTTON_HEIGHT_CLASSES;

/** 13 / 14 / 15. También del Botón. */
export const FIELD_FONT_SIZES = BUTTON_FONT_SIZES;

/**
 * 10 / 12 / 14, y a propósito NO el 12 / 16 / 20 del Botón: el relleno de un botón
 * separa su etiqueta del borde, el de un campo separa el cursor, y un campo suele
 * ser mucho más ancho que su contenido.
 */
export const FIELD_PADDING_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'px-2.5',
  md: 'px-3',
  lg: 'px-3.5',
};

/**
 * Los iconos decorativos de un campo son `sm` (16 px) en TODOS los tamaños, como
 * el del botón Small: la regla es sobre filas, no sobre campos, y dos tamaños de
 * icono en una fila se leen como un error.
 */
export const FIELD_ICON_SIZE: IconSize = 'sm';

/**
 * La caja. `border-solid` va explícito porque el preflight de Tailwind resetea
 * todo a `0 solid`: dejar el estilo implícito está a un reset de un campo
 * invisible. `outline-none` saca el anillo del user-agent que reemplaza el token.
 */
export const FIELD_BASE_CLASSES =
  'w-full box-border rounded-control border border-solid outline-none ' +
  'focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Color de borde por estado. El foco se pasa como argumento en vez de expresarse
 * como variante `:focus` porque no hay utilidad de borde para el azul de acción,
 * y además una cadena calculada es algo que jsdom puede afirmar.
 * EL ERROR GANA AL FOCO: un campo en error que recibe foco conserva el borde de
 * peligro y suma el anillo. El sistema tiene un solo color de foco (Fundamentos
 * de Marca).
 */
export function fieldBorderColor(state: FieldState, focused: boolean): string {
  if (state === 'error') {
    return 'var(--color-bg-danger)';
  }
  if (state === 'disabled' || state === 'readonly') {
    return 'var(--color-border)';
  }
  return focused ? 'var(--color-bg-primary)' : 'var(--color-border-strong)';
}

/**
 * Superficie, frente y cursor por estado. DESHABILITADO Y SOLO-LECTURA COMPARTEN
 * EL FONDO Y NADA MÁS: el texto de solo-lectura es contenido real que alguien
 * puede necesitar leer y copiar, así que conserva el frente primario. Pintarlo
 * `text-disabled` haría que un valor inmodificable parezca no disponible.
 */
export function fieldSurfaceClasses(state: FieldState): string {
  switch (state) {
    case 'disabled':
      return 'bg-secondary text-disabled cursor-not-allowed';
    case 'readonly':
      return 'bg-secondary text-primary cursor-default';
    default:
      return 'bg-surface text-primary';
  }
}
