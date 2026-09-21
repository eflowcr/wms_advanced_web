import type { Signal } from '@angular/core';

/**
 * Lo que un grupo necesita de las cards que tiene adentro, y nada más. Existe para
 * romper un ciclo y no para abstraer: `ewms-card` inyecta `CardGroup` para saber si
 * está dentro de uno, así que el grupo no puede importar la card para consultarla.
 * Las cards se registran por esta interfaz en orden de construcción, que en una
 * plantilla es orden del DOM, que es lo que tienen que seguir las flechas.
 */
export interface CardGroupMember {
  /** Cuánto vale esta card al ser la elegida. */
  readonly optionValue: Signal<unknown>;
  /** Su propia entrada `disabled`, antes de sumarle la del grupo. */
  readonly ownDisabled: Signal<boolean>;
  /** Traé el teclado acá. */
  focus(): void;
}

/**
 * La caja, en los dos usos. `shadow-sm` es la «card en reposo» de la escala de
 * elevación y el único nivel que toma una card: una que subiera al nivel de un
 * desplegable se leería flotando sobre la página en vez de apoyada en ella.
 */
export const CARD_BASE_CLASSES = 'flex flex-col gap-3 rounded-md border border-solid p-4 shadow-sm';

/**
 * Lo que suma una card cuando es una opción de un grupo: blanco, puntero y el
 * anillo de foco del sistema. `outline-none` va emparejado con su reemplazo en la
 * misma línea y nunca solo, como en todo control de esta librería.
 */
export const CARD_SELECTABLE_CLASSES =
  'w-full text-left select-none outline-none focus-visible:shadow-(--focus-ring-shadow)';

/**
 * Superficie y borde de una card seleccionable.
 *
 * ELEGIDA ES BORDE Y RELLENO, y el borde es el acento. `--color-row-selected` nunca
 * puede ser la única señal -Fundamentos de Marca lo acompaña con una barra, porque
 * el tinte solo queda a un pelo de `--color-ghost-hover`-. Una card no necesita una
 * barra de 3 px: su contorno entero se vuelve el azul de acción, que es la misma
 * garantía dibujada más grande, y el tilde de la esquina es la tercera pista.
 * Deshabilitada va primero y sin hover: una card que no se puede elegir no se
 * enciende bajo el puntero.
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
