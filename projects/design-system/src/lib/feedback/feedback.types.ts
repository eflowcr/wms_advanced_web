import type { IconName } from '../../icons/icons.generated';
import type { IconSize } from '../icon/icon';

/**
 * Lo que Banner y Toast comparten: dos formatos del mismo mensaje y un solo
 * vocabulario de severidad. INFO SE LLAMA INFO Y SE PINTA NEUTRAL: no hay
 * familia `info` en tokens.css y no la va a haber, porque un azul informativo
 * midió 1.76:1 contra el azul de acción. `FEEDBACK_FAMILIES` es el único lugar
 * que traduce el nombre público a la familia de token.
 */
export type FeedbackVariant = 'success' | 'warning' | 'danger' | 'info';

/**
 * Las cuatro familias de color, por su nombre. NO es el vocabulario de
 * `FeedbackVariant`: una variante es lo que PIDE un consumidor y una familia es
 * con lo que pinta `tokens.css`. Coinciden tres de cuatro veces; `info` mapea a
 * `neutral`, y ese único mapeo es por qué existen los dos tipos.
 */
export type SemanticFamily = 'success' | 'warning' | 'danger' | 'neutral';

/** Con qué familia pinta cada variante. Info -> neutral, a propósito. */
export const FEEDBACK_FAMILIES: Readonly<Record<FeedbackVariant, SemanticFamily>> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'neutral',
};

/**
 * Superficie, borde y frente de una familia, ESCRITOS ENTEROS. Tailwind escanea
 * texto crudo: una clase armada como `bg-${family}-surface` es una cadena que
 * nunca ve. El frente es el `-text` de la familia y el icono lo hereda.
 */
export function familyBoxClasses(family: SemanticFamily): string {
  switch (family) {
    case 'success':
      return 'bg-success-surface border-success text-success';
    case 'warning':
      return 'bg-warning-surface border-warning text-warning';
    case 'danger':
      return 'bg-danger-surface border-danger text-danger';
    case 'neutral':
      return 'bg-neutral-surface border-neutral text-neutral';
  }
}

/**
 * Solo el tinte, sin borde ni frente: lo que toma una fila de tabla. La fila
 * conserva el color de texto primario, porque pintarla entera en `-text` haría
 * el SKU de una fila de aviso más difícil de leer que el de una normal.
 */
export function familyTintClass(family: SemanticFamily): string {
  switch (family) {
    case 'success':
      return 'bg-success-surface';
    case 'warning':
      return 'bg-warning-surface';
    case 'danger':
      return 'bg-danger-surface';
    case 'neutral':
      return 'bg-neutral-surface';
  }
}

/**
 * El icono por familia. LOS MISMOS cuatro dibujos en Banner, Toast y tabla: quien
 * aprendió que el círculo tachado es «incidencia» en un toast tiene que
 * reconocerlo en una fila.
 */
export function familyIcon(family: SemanticFamily): IconName {
  switch (family) {
    case 'success':
      return 'circle-check';
    case 'warning':
      return 'alert-triangle';
    case 'danger':
      return 'circle-x';
    case 'neutral':
      return 'info-circle';
  }
}

/**
 * El icono por severidad, ELEGIDO POR EL COMPONENTE y nunca recibido: dejarlo
 * pasar es cómo una pantalla termina con un triángulo sobre un mensaje de éxito.
 */
export const FEEDBACK_ICONS: Readonly<Record<FeedbackVariant, IconName>> = {
  success: familyIcon('success'),
  warning: familyIcon('warning'),
  danger: familyIcon('danger'),
  info: familyIcon('neutral'),
};

/**
 * `alert` interrumpe, `status` espera su turno. Danger y Warning hay que
 * atenderlos y valen cortar lo que el lector de pantalla esté diciendo; anunciar
 * «guardado» encima de la frase que alguien escucha es peor que anunciarlo
 * después. Notificaciones.md prohíbe que los cuatro compartan rol.
 */
export function feedbackRole(variant: FeedbackVariant): 'alert' | 'status' {
  return variant === 'danger' || variant === 'warning' ? 'alert' : 'status';
}

/**
 * Superficie, borde y frente de una severidad. El frente es el `-text` de la
 * familia y el icono lo hereda: contra su propia `-surface`, `-text` mide
 * 5.58 / 5.34 / 5.34 / 9.04 y pasa el 3:1 de WCAG 1.4.11 con aire, mientras
 * `-solid` mide 4.28 / 4.13 / 4.12 / 3.71. Números en Notificaciones.md.
 */
export function feedbackSurfaceClasses(variant: FeedbackVariant): string {
  return familyBoxClasses(FEEDBACK_FAMILIES[variant]);
}

/**
 * La barra de acento de 4 px del toast, y es `-solid` y no `-border`: contra la
 * superficie donde se apoya, `-border` mide 1.62 / 1.53 / 1.53 / 1.45 -un acento
 * que no se ve- y `-solid` mide 4.28 / 4.13 / 4.12 / 3.71. Primer consumidor de
 * la familia solid, que la ficha anotaba sin ninguno.
 */
export function feedbackAccentClasses(variant: FeedbackVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-success-solid';
    case 'warning':
      return 'bg-warning-solid';
    case 'danger':
      return 'bg-danger-solid';
    case 'info':
      return 'bg-neutral-solid';
  }
}

/** 18 px, el `md` del sistema: se lee como símbolo y no grita en un toast. */
export const FEEDBACK_ICON_SIZE: IconSize = 'md';
