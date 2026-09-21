import type { Signal } from '@angular/core';

/**
 * Rompe el ciclo card ↔ grupo (la card inyecta `CardGroup`). Las cards se registran en orden
 * de construcción, que es el orden del DOM que siguen las flechas.
 */
export interface CardGroupMember {
  readonly optionValue: Signal<unknown>;
  /** Su propio `disabled`, antes de sumarle el del grupo. */
  readonly ownDisabled: Signal<boolean>;
  focus(): void;
}

/** Solo el nivel «card en reposo»: más alto se leería flotando sobre la página. */
export const CARD_BASE_CLASSES = 'flex flex-col gap-3 rounded-md border border-solid p-4 shadow-sm';

/** Opción de grupo: el quitar-outline va siempre en la misma línea que su anillo de reemplazo. */
export const CARD_SELECTABLE_CLASSES =
  'w-full text-left select-none outline-none focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Elegida = borde azul de acción + relleno: el contorno hace de barra de acento y el tilde
 * es la tercera pista. Deshabilitada va primero y sin hover. Ver vault: Cards.
 */
export function cardSelectableClasses(selected: boolean, disabled: boolean): string {
  if (disabled) {
    return 'bg-secondary border-default text-disabled cursor-not-allowed';
  }
  if (selected) {
    return 'bg-row-selected border-(--color-bg-primary) text-primary cursor-pointer';
  }
  return 'bg-surface border-default text-primary cursor-pointer hover:border-strong';
}
