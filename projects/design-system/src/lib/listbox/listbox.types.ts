/**
 * What every floating list in this library shares: how it looks, and how the
 * arrow keys move inside it.
 *
 * EXTRACTED IN DS-3, AND THAT IS A HARD GATE RATHER THAN TIDINESS.
 * REQ-FE-DS3-001 HG-04 forbids a second overlay or a second keyboard
 * implementation alongside `ewms-select`. The overlay was already shared
 * (overlay/connected-overlay.ts); this is the other half -- the panel, the
 * rows, and the movement -- so that `ewms-select` and `ewms-search-select`
 * cannot drift on what an active row looks like or on whether the list wraps.
 *
 * `select.types.ts` re-exports these under the names it already used, so the
 * Select's own code and spec did not have to be rewritten to prove the point.
 */

/**
 * The floating panel.
 *
 * `--shadow-md` is the dropdown level of the elevation scale (`sm` is a card
 * at rest, `lg` is a modal), and the surface is the same white the field sits
 * on. `max-h-72` with `overflow-y-auto` is what stops a long list from running
 * off the bottom of the window -- NOT a limit on how many rows may be passed.
 *
 * `w-full` is load-bearing. The components size the overlay PANE to the
 * trigger's width, but the CDK's prebuilt stylesheet makes `.cdk-overlay-pane`
 * a flex container, and a flex item is content-sized on the main axis. Without
 * this the list comes out narrower than the field it belongs to.
 */
export const LISTBOX_PANEL_CLASSES =
  'w-full bg-surface rounded-control shadow-md py-1 max-h-72 overflow-y-auto list-none p-0';

export const LISTBOX_OPTION_BASE_CLASSES =
  'flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer';

/**
 * The two things a row can be, and they are independent.
 *
 * SELECTED is "this is the current value": the action blue, semibold, and a
 * check on the right. ACTIVE is "this is where the keyboard is": the same
 * ghost-hover background the mouse produces, so a list driven by the arrow
 * keys looks exactly like a list under the pointer. One row is usually both.
 */
export function listboxOptionClasses(selected: boolean, active: boolean): string {
  const classes = [LISTBOX_OPTION_BASE_CLASSES];
  if (active) {
    classes.push('bg-ghost-hover');
  }
  if (selected) {
    classes.push('text-(--color-bg-primary)');
  }
  return classes.join(' ');
}

/**
 * The weight of the selected row, read as a token because the type scale's
 * weights are not Tailwind utilities here: ADR 0009 deletes Tailwind's theme,
 * so a font-weight utility compiles to nothing at all.
 */
export const LISTBOX_SELECTED_WEIGHT = 'var(--text-control-selected-weight)';

/**
 * Where the keyboard goes next.
 *
 * IT STOPS AT THE ENDS RATHER THAN WRAPPING, and that is the opposite of the
 * card group's answer on purpose. A panel is a list somebody is reading
 * through, and reaching the end of it is information; wrapping turns "hold the
 * down arrow" into an endless loop with no signal that the list finished. A
 * radio group, by contrast, is a closed set of four things, where stopping at
 * the last one only makes a person press the other arrow.
 *
 * `from < 0` means "nowhere yet", which is what a panel opened with no current
 * value starts at: the first press then lands on an end rather than on the
 * second row.
 */
export function moveActiveIndex(from: number, delta: number, count: number): number {
  if (count === 0) {
    return -1;
  }
  const next = from < 0 ? (delta > 0 ? 0 : count - 1) : from + delta;
  return Math.min(count - 1, Math.max(0, next));
}
