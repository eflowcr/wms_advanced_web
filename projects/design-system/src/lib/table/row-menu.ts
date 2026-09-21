import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Injector, type ViewContainerRef, type TemplateRef } from '@angular/core';
import { createConnectedOverlay, type ConnectedPositionList } from '../overlay/connected-overlay';
import { moveActiveIndex } from '../listbox/listbox.types';
import type { MenuItem } from './table.types';

export { moveActiveIndex };

/**
 * El menú contextual de una fila, como el poco estado que de verdad es. NO ES UN
 * COMPONENTE: un menú necesita un overlay (ya compartido), una lista con flechas
 * (ya compartida) y dónde recordar a qué fila pertenece. Un componente habría
 * sumado un segundo overlay y un segundo teclado, que es lo que HG-04 evita.
 */
export interface MenuAnchor {
  /** Adónde apunta el menú. Una celda en clic derecho, el kebab si se pulsó. */
  readonly element: HTMLElement;
  /** A qué fila pertenece, por la clave de `trackBy`. */
  readonly key: unknown;
}

/**
 * Las posiciones de un menú de fila. CUATRO, Y ALINEADAS AL FINAL PRIMERO: no son
 * las del Select. Un panel cuelga de un gatillo que empieza a la izquierda de su
 * campo; un menú de fila cuelga de un kebab que está a la DERECHA, y alineado al
 * inicio se abre hacia afuera -en la primera captura quedó pegado al borde de la
 * ventana-. El par alineado al inicio queda de último recurso.
 */
export const MENU_POSITIONS: ConnectedPositionList = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
];

export const MENU_CLASSES =
  'min-w-48 bg-surface rounded-control shadow-md py-1 list-none p-0 border border-default';

/** Todo lo que lleva una entrada en cualquier estado. ACÁ NO HAY COLOR. */
export const MENU_ITEM_CLASSES = 'flex w-full items-center gap-2 px-3 py-1.5 text-p';

/**
 * EXACTAMENTE UNA UTILIDAD DE COLOR POR ENTRADA, elegida acá. La forma obvia -una
 * base con `text-primary` y un modificador después- no funciona: las dos son
 * declaraciones de `color` en la misma capa de Tailwind, así que gana la que quede
 * antes en la hoja generada y NO el orden del atributo. En la primera captura la
 * entrada deshabilitada se veía como cualquier otra.
 */
const MENU_ITEM_TONES = {
  normal: 'cursor-pointer text-primary',
  /** La entrada destructiva, y la única que lleva color. */
  danger: 'cursor-pointer text-danger',
  /** Deshabilitada gana a peligro: una entrada roja que no se puede pulsar engaña. */
  disabled: 'cursor-not-allowed text-disabled',
} as const;

export const MENU_SEPARATOR_CLASSES = 'my-1 border-t border-default';

export function menuItemClasses(item: MenuItem, active: boolean): string {
  const tone = item.disabled ? 'disabled' : item.tone === 'danger' ? 'danger' : 'normal';
  const classes = [MENU_ITEM_CLASSES, MENU_ITEM_TONES[tone]];
  if (active && !item.disabled) {
    classes.push('bg-ghost-hover');
  }
  return classes.join(' ');
}

/**
 * Adónde va el teclado DENTRO DE UN MENÚ, salteando lo que no se puede elegir. Una
 * entrada deshabilitada queda visible -es información- y fuera del recorrido:
 * frenar en ella haría sentir rotas las flechas en las filas donde lo esté.
 */
export function moveMenuIndex(items: readonly MenuItem[], from: number, delta: number): number {
  const enabled = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.disabled);
  if (enabled.length === 0) {
    return -1;
  }
  const current = enabled.findIndex(({ index }) => index === from);
  const next = moveActiveIndex(current, delta, enabled.length);
  return enabled[next]?.index ?? -1;
}

/** Arma el overlay donde vive un menú de fila. Un lugar, un juego de posiciones. */
export function createMenuOverlay(
  injector: Injector,
  origin: HTMLElement,
  viewContainerRef: ViewContainerRef,
  template: TemplateRef<unknown>,
  positions: ConnectedPositionList,
): OverlayRef {
  const overlayRef = createConnectedOverlay(injector, origin, positions);
  overlayRef.attach(new TemplatePortal(template, viewContainerRef));
  return overlayRef;
}
