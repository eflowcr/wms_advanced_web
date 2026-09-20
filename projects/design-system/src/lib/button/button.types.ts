import type { IconSize } from '../icon/icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonIconPosition = 'left' | 'right';

/** Tamaño de icono por tamaño de botón. `lg` usa el icono `md` a propósito:
 * iconos más grandes desbalancean una barra de herramientas. */
export const BUTTON_ICON_SIZES: Readonly<Record<ButtonSize, IconSize>> = {
  sm: 'sm',
  md: 'md',
  lg: 'md',
};

/** Token de tamaño de fuente por tamaño de botón. */
export const BUTTON_FONT_SIZES: Readonly<Record<ButtonSize, string>> = {
  sm: 'var(--text-control-sm-size)',
  md: 'var(--text-control-md-size)',
  lg: 'var(--text-control-lg-size)',
};

export const BUTTON_HEIGHT_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
};

/** Relleno horizontal por tamaño, para botones con texto. */
export const BUTTON_PADDING_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'px-3',
  md: 'px-4',
  lg: 'px-5',
};

/** Caja cuadrada por tamaño, para botones de icono. */
export const ICON_BUTTON_SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

/**
 * Las utilidades que llevan Button e Icon Button por igual.
 *
 * `relative` ancla el spinner absoluto, así ocultar el contenido no cambia la
 * caja. El anillo es `:focus-visible` y no `:focus`: decide el navegador.
 * `outline-none` saca el anillo del user-agent que reemplaza la sombra de
 * `--focus-ring-shadow` -nunca se saca sin reemplazo-, y es box-shadow y no
 * outline porque el token pinta dos bandas.
 *
 * NO HAY TRANSICIÓN DE COLOR, a propósito, y su nombre no se escribe en ningún
 * lado de este repositorio, comentarios incluidos: Tailwind escanea texto crudo
 * y no sabe qué es un comentario, así que nombrarla emite una regla muerta en el
 * CSS enviado. El error se cometió dos veces escribiendo este mismo comentario y
 * lo atrapó el tamaño del bundle. Volver a ponerla necesita un token de duración
 * en tokens.css, porque `--*: initial` borra la duración por defecto y la clase
 * compila cayendo a cero: parece que anima y no anima (ADR 0009).
 *
 * Vive acá y no en una hoja de componente porque esas se inyectan en línea y la
 * CSP estricta las bloquea (ADR 0010).
 */
export const BUTTON_BASE_CLASSES =
  'relative inline-flex items-center justify-center rounded-control outline-none select-none ' +
  'focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Colores por variante y estado, compartidos para que no deriven. Deshabilitado
 * gana sobre la paleta interactiva: no tiene hover ni activo.
 *
 * GHOST LLEVA SU FRENTE ACÁ, COMO CLASE Y NO COMO ESTILO EN LÍNEA. Su frente es
 * el azul de marca, que en el tema es un rol de fondo y no tiene utilidad
 * `text-*` propia. Una declaración en línea no puede expresar un hover, y Ghost
 * lo necesita: el azul de marca sobre `--color-ghost-hover` mide 4.38:1, bajo el
 * 4.5:1 de WCAG 1.4.3, y el tono de hover de la misma rampa mide 5.65:1.
 * Ghost oscurece su TEXTO en hover igual que Primary su fondo: el mismo gesto,
 * no una excepción (Boton.md, decisión del 2026-09-18). El spinner queda en
 * `--color-bg-primary`: no es texto, y 1.4.11 le pide 3:1.
 */
export function buttonVariantClasses(variant: ButtonVariant, disabled: boolean): string {
  if (disabled) {
    switch (variant) {
      case 'primary':
        return 'bg-primary-disabled text-disabled cursor-not-allowed';
      case 'secondary':
        return 'bg-surface border border-default text-disabled cursor-not-allowed';
      case 'danger':
        return 'bg-danger-disabled text-disabled cursor-not-allowed';
      case 'ghost':
        return 'bg-transparent text-disabled cursor-not-allowed';
    }
  }

  switch (variant) {
    case 'primary':
      return 'bg-primary hover:bg-primary-hover active:bg-primary-active text-on-primary cursor-pointer';
    case 'secondary':
      return 'bg-secondary hover:bg-secondary-hover border border-strong text-primary cursor-pointer';
    case 'danger':
      return 'bg-danger hover:bg-danger-hover active:bg-danger-active text-on-primary cursor-pointer';
    case 'ghost':
      return (
        'bg-transparent hover:bg-ghost-hover cursor-pointer ' +
        'text-(color:--color-bg-primary) hover:text-(color:--color-bg-primary-hover)'
      );
  }
}

/** El spinner hereda el frente, salvo donde el color de texto de la variante no
 * es lo que debería girar. */
export function buttonSpinnerColor(variant: ButtonVariant): string {
  switch (variant) {
    case 'secondary':
      return 'var(--color-text-secondary)';
    case 'ghost':
      return 'var(--color-bg-primary)';
    default:
      return 'inherit';
  }
}

/**
 * Si una interacción no puede llegar al consumidor. `loading` es independiente de
 * `disabled`: un botón cargando conserva el foco nativo, así que el atributo
 * `disabled` no puede ser lo que frena el segundo clic. Este predicado sí.
 */
export function isInteractionBlocked(disabled: boolean, loading: boolean): boolean {
  return disabled || loading;
}

/** Corta un evento en seco, incluidos los listeners del mismo elemento y los de
 * cualquier ancestro. */
export function suppressEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();
}
