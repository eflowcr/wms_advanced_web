import { BUTTON_FONT_SIZES, BUTTON_HEIGHT_CLASSES, type ButtonSize } from '../button/button.types';
import type { IconSize } from '../icon/icon';

// Caja común de Input y Select; alturas y escala tipográfica son las del Botón, importadas,
// así campo, select y botón se alinean en una fila.

export type FieldSize = ButtonSize;

/** `error` es solo visual: valida el formulario. */
export type FieldState = 'default' | 'error' | 'disabled' | 'readonly';

/** 32 / 40 / 48, del Botón. */
export const FIELD_HEIGHT_CLASSES = BUTTON_HEIGHT_CLASSES;

/** 13 / 14 / 15, del Botón. */
export const FIELD_FONT_SIZES = BUTTON_FONT_SIZES;

/** 10 / 12 / 14 y no el 12 / 16 / 20 del Botón: acá el relleno separa el cursor, no una etiqueta. */
export const FIELD_PADDING_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'px-2.5',
  md: 'px-3',
  lg: 'px-3.5',
};

/** 16 px en todo tamaño: dos tamaños de icono en una fila se leen como un error. */
export const FIELD_ICON_SIZE: IconSize = 'sm';

/** Estilo de borde explícito: el preflight de Tailwind lo resetea y el campo quedaría invisible. */
export const FIELD_BASE_CLASSES =
  'w-full box-border rounded-control border border-solid outline-none ' +
  'focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Foco por argumento: no hay utilidad de borde para el azul de acción, y jsdom puede afirmarlo.
 * El error gana al foco, que suma el anillo (un solo color de foco, Fundamentos de Marca).
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

/** Solo-lectura comparte con deshabilitado solo el fondo: es contenido y va en primario. */
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
