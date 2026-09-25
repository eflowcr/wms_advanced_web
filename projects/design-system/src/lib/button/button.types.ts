import type { IconSize } from '../icon/icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonIconPosition = 'left' | 'right';

/** `lg` usa el icono `md` a propósito: uno más grande desbalancea una barra de herramientas. */
export const BUTTON_ICON_SIZES: Readonly<Record<ButtonSize, IconSize>> = {
  sm: 'sm',
  md: 'md',
  lg: 'md',
};

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

export const BUTTON_PADDING_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'px-3',
  md: 'px-4',
  lg: 'px-5',
};

/** Link, en `sm` y `md`: sin fondo, el relleno solo separa el anillo de foco del texto. */
export const LINK_PADDING_CLASS = 'px-2';

/** Solo ícono: cuadrado, mismo paso de escala en los dos ejes. */
export const ICON_ONLY_BOX_CLASSES: Readonly<Record<ButtonSize, string>> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

/**
 * Comunes a todas las variantes (ADR 0010). El anillo de foco es sombra de dos bandas. Sin
 * transición de color, y su nombre no se escribe ni en comentarios. Ver vault: ADR 0009.
 */
export const BUTTON_BASE_CLASSES =
  'relative inline-flex items-center justify-center rounded-control outline-none select-none ' +
  'focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Deshabilitado gana: sin hover ni activo. Ghost lleva su frente como clase, porque en hover
 * oscurece el texto (4.38:1 no pasa, 5.65:1 sí) y en línea no hay hover. Link descansa en el tono
 * de hover: el de marca mide 4.31:1 sobre la superficie de peligro. Ver vault: Boton.
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
      case 'link':
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
    case 'link':
      return 'bg-transparent cursor-pointer text-(color:--color-bg-primary-hover) hover:underline';
  }
}

/** Hereda el frente, salvo donde el texto de la variante no es lo que debería girar. */
export function buttonSpinnerColor(variant: ButtonVariant): string {
  switch (variant) {
    case 'secondary':
      return 'var(--color-text-secondary)';
    case 'ghost':
      return 'var(--color-bg-primary)';
    case 'link':
      return 'var(--color-bg-primary-hover)';
    default:
      return 'inherit';
  }
}

/** Cargando conserva el foco, así que el atributo `disabled` no frena el segundo clic: esto sí. */
export function isInteractionBlocked(disabled: boolean, loading: boolean): boolean {
  return disabled || loading;
}

export function suppressEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();
}
