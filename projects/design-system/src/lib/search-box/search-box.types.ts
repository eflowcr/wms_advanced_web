import { InjectionToken } from '@angular/core';

/** Nombres de los dos botones: los mismos en toda la aplicación, así que van por token (ADR 0008). */
export interface SearchBoxMessages {
  readonly submit: string;
  readonly clear: string;
}

export const EWMS_SEARCH_BOX_MESSAGES = new InjectionToken<SearchBoxMessages>(
  'EWMS_SEARCH_BOX_MESSAGES',
);

/** Sin proveedor quedan vacíos, y en desarrollo el buscador avisa que sus botones no tienen nombre. */
export const NO_SEARCH_BOX_MESSAGES: SearchBoxMessages = { submit: '', clear: '' };

/** Lo que sale es la búsqueda, no lo tipeado: sin espacios en los bordes ni repetidos. */
export function normalizeQuery(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Píldora partida: el `<input>` es la mitad izquierda y lleva borde, forma y anillo, como en Input
 * (el foco se ve en el elemento enfocado). El borde va por clase para que el catálogo pueda forzar
 * hover y foco con la misma utilidad. `pr-10` deja lugar a la pista o a la ×.
 */
export function searchFieldClasses(disabled: boolean): string {
  const base =
    'h-full w-full min-w-0 rounded-l-full border border-r-0 border-solid pl-4 pr-10 outline-none ' +
    'placeholder:text-secondary ';
  return disabled
    ? base + 'border-default bg-secondary text-disabled cursor-not-allowed'
    : base +
        'border-strong bg-surface text-primary hover:border-strong-hover ' +
        'focus:border-(color:--color-focus-ring) focus-visible:shadow-(--focus-ring-shadow)';
}

/** Sin texto que buscar el botón está apagado, con el ícono en secundario: vacío no busca. */
export function searchButtonClasses(disabled: boolean, ready: boolean): string {
  const base =
    'flex shrink-0 items-center justify-center rounded-r-full border border-solid bg-secondary ' +
    'px-5 outline-none focus-visible:shadow-(--focus-ring-shadow) ';
  if (disabled) {
    return base + 'border-default text-disabled cursor-not-allowed';
  }
  return ready
    ? base + 'border-strong text-primary cursor-pointer hover:bg-secondary-hover'
    : base + 'border-strong text-secondary';
}
