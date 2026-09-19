/**
 * One row of the panel.
 *
 * `label` is the text a person reads, already translated by the consumer --
 * the design system speaks no language (ADR 0008). `value` is what the form
 * receives, and it is `unknown` on purpose: an id, a code, an enum member or a
 * whole object are all legitimate, and narrowing it here would push every
 * consumer into a cast.
 */
export interface SelectOption {
  label: string;
  value: unknown;
}

/**
 * The floating panel.
 *
 * `--shadow-md` is the dropdown level of the elevation scale (`sm` is a card
 * at rest, `lg` is a modal), and the surface is the same white the field sits
 * on. `max-h-72` with `overflow-y-auto` is what stops a long list from running
 * off the bottom of the window -- NOT a limit on how many options may be
 * passed, which the ficha forbids: the template renders all of them.
 *
 * Virtual scrolling for lists past a hundred options (locations, SKUs) is
 * noted in the ficha and deliberately absent here. It is an optimisation with
 * no consumer yet, and the CDK's version of it changes how the panel is
 * measured -- worth doing once something is actually slow.
 */
/*
 * `w-full` is load-bearing. The component sizes the overlay PANE to the
 * trigger's width (select.ts), but the CDK's prebuilt stylesheet makes
 * `.cdk-overlay-pane` a flex container, and a flex item is content-sized on
 * the main axis. Without this the list came out narrower than the field it
 * belongs to -- which is exactly what the first render of this code in a
 * browser showed (DS-2 PR 3).
 */
export const SELECT_PANEL_CLASSES =
  'w-full bg-surface rounded-control shadow-md py-1 max-h-72 overflow-y-auto list-none p-0';

export const SELECT_OPTION_BASE_CLASSES =
  'flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer';

/**
 * The two things a row can be, and they are independent.
 *
 * SELECTED is "this is the current value": the action blue, semibold, and a
 * check on the right. ACTIVE is "this is where the keyboard is": the same
 * ghost-hover background the mouse produces, so a list driven by the arrow
 * keys looks exactly like a list under the pointer. One row is usually both.
 */
export function selectOptionClasses(selected: boolean, active: boolean): string {
  const classes = [SELECT_OPTION_BASE_CLASSES];
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
 * so a font-weight utility compiles to nothing at all. See
 * `--text-control-selected-weight`.
 */
export const SELECT_SELECTED_WEIGHT = 'var(--text-control-selected-weight)';
