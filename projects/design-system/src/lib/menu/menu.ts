import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Injector, type ViewContainerRef, type TemplateRef } from '@angular/core';
import { createConnectedOverlay, type ConnectedPositionList } from '../overlay/connected-overlay';
import { moveActiveIndex } from '../listbox/listbox.types';
import type { MenuItem } from './menu.types';

// Menú de la fila de la Tabla y del split button. No es un componente: overlay y lista ya
// compartidos; uno propio duplicaría teclado (HG-04).

// Alineadas al final primero: el kebab está a la derecha y alineado al inicio el menú se sale
// de la ventana (así salió en la primera captura).
export const MENU_POSITIONS: ConnectedPositionList = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
];

/** Sin contorno al enfocarse: el indicador es la opción activa (`aria-activedescendant`). */
export const MENU_CLASSES =
  'min-w-48 bg-surface rounded-control shadow-md py-1 list-none p-0 border border-default ' +
  'outline-none';

/** El hueco existe tenga o no ícono la opción: así los textos quedan alineados. */
export const MENU_ICON_SLOT_CLASSES = 'inline-flex size-icon-sm shrink-0';

/** Acá no hay color. */
export const MENU_ITEM_CLASSES = 'flex w-full items-center gap-2 px-3 py-1.5 text-p';

// Una sola utilidad de color por entrada: dos declaraciones de `color` en la misma capa las
// decide el orden de la hoja generada, no el del atributo.
const MENU_ITEM_TONE_CLASSES = {
  normal: 'cursor-pointer text-primary',
  danger: 'cursor-pointer text-danger',
  /** Deshabilitada gana a peligro: una entrada roja que no se puede pulsar engaña. */
  disabled: 'cursor-not-allowed text-disabled',
} as const;

export const MENU_SEPARATOR_CLASSES = 'my-1 border-t border-default';

export function menuItemClasses(item: MenuItem, active: boolean): string {
  const tone = item.disabled ? 'disabled' : item.tone === 'danger' ? 'danger' : 'normal';
  const classes = [MENU_ITEM_CLASSES, MENU_ITEM_TONE_CLASSES[tone]];
  if (active && !item.disabled) {
    classes.push('bg-ghost-hover');
  }
  return classes.join(' ');
}

/** Saltea las deshabilitadas: siguen visibles pero frenar en ellas rompe las flechas. */
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
