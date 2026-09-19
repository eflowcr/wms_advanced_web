import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Injector, type ViewContainerRef, type TemplateRef } from '@angular/core';
import { createConnectedOverlay, type ConnectedPositionList } from '../overlay/connected-overlay';
import { moveActiveIndex } from '../listbox/listbox.types';
import type { MenuItem } from './table.types';

export { moveActiveIndex };

/**
 * The row's context menu, as the small amount of state it really is.
 *
 * NOT A COMPONENT, and that is the point: what a menu needs is an overlay
 * (already shared, `overlay/`), a list with arrow keys (already shared,
 * `listbox/`) and somewhere to remember which row it belongs to. A component
 * would have added a second overlay, a second keyboard and a third place for
 * the two to disagree -- which is the thing DS-3 spent a hard gate avoiding.
 */
export interface MenuAnchor {
  /** Where the menu points. A cell for a right-click, the kebab for a press. */
  readonly element: HTMLElement;
  /** Which row it belongs to, by `trackBy` key. */
  readonly key: unknown;
}

/**
 * The positions a row menu takes. FOUR, AND END-ALIGNED FIRST.
 *
 * Not the Select's pair. A panel hangs under a trigger that starts at the left
 * of its field, so start-aligned is right there. A row menu hangs off a kebab
 * that sits at the RIGHT end of the row, and a start-aligned menu there opens
 * outwards into the margin -- in the first capture of this menu it ended up
 * flush against the edge of the window. Lining its right edge up with the
 * kebab is what every desktop menu does, and it is what leaves the menu over
 * the table it belongs to.
 *
 * The start-aligned pair stays as the last resort, for a kebab close enough to
 * the left edge that an end-aligned menu would hang off that side instead.
 */
export const MENU_POSITIONS: ConnectedPositionList = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
];

export const MENU_CLASSES =
  'min-w-48 bg-surface rounded-control shadow-md py-1 list-none p-0 border border-default';

/** Everything an entry has whatever state it is in. NO COLOUR HERE. */
export const MENU_ITEM_CLASSES = 'flex w-full items-center gap-2 px-3 py-1.5 text-p';

/**
 * EXACTLY ONE COLOUR UTILITY PER ENTRY, chosen here.
 *
 * The obvious shape -- a base with `text-primary` and a modifier appended
 * after it -- does not work: both are `color` declarations in the same
 * Tailwind layer, so which one wins is decided by the order they happen to
 * sit in the generated stylesheet and NOT by the order of the class
 * attribute. It read as "the disabled entry looks like every other entry" in
 * the first capture of the menu, which is exactly the sort of thing a rule
 * that is right by construction prevents.
 */
const MENU_ITEM_TONES = {
  normal: 'cursor-pointer text-primary',
  /** The destructive entry, and the only one that is coloured. */
  danger: 'cursor-pointer text-danger',
  /** Disabled beats danger: a red entry somebody cannot press is a trap. */
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
 * Where the keyboard goes next INSIDE A MENU, skipping what cannot be chosen.
 *
 * A disabled entry stays visible -- it is information, "you cannot do this
 * here" -- and stays out of the walk: stopping on it would make the arrow keys
 * feel broken on the rows where it happens to be disabled.
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

/** Build the overlay a row menu lives in. One place, one set of positions. */
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
