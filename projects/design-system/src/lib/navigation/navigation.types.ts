import type { IconName } from '../../icons/icons.generated';

/**
 * THE SHAPES THE NAVIGATION PIECES RECEIVE, and the line they do not cross.
 *
 * None of these carries a route object, a permission, a menu identifier or a
 * component. A `route` is a plain string because the pieces never navigate:
 * they emit what was chosen and the consumer -- the shell, which is the only
 * thing that knows what a route means -- does the navigating.
 *
 * That is not tidiness. A navigation piece that imports `@angular/router`
 * cannot be shown in the showroom without a router, cannot be reused by a
 * second application with a different route tree, and quietly decides policy
 * (which item is active) that belongs to whoever owns the tree.
 */

/**
 * One entry of a navigation tree.
 *
 * A node with `children` is a GROUP: it is not a destination, it opens. A node
 * without them is a destination. Nothing else distinguishes the two, and
 * nothing may: a group that is also a link makes "what does clicking this do?"
 * depend on where in the control you clicked.
 */
export interface NavItem {
  /** Stable across renders. It is what `activeId` and `itemSelect` speak in. */
  readonly id: string;
  /** Already translated by the consumer (ADR 0008). */
  readonly label: string;
  readonly icon: IconName;
  /**
   * Where it goes, for the consumer to interpret. Absent on a group.
   *
   * A plain string on purpose: `Router` types would drag `@angular/router`
   * into a presentation library.
   */
  readonly route?: string;
  /** Present on a group, absent on a destination. Never an empty array. */
  readonly children?: readonly NavItem[];
  /** A small count beside the label -- pending tasks, unread alerts. */
  readonly badge?: number;
}

/** One document tab. */
export interface Tab {
  readonly id: string;
  /** Already translated by the consumer. */
  readonly label: string;
  /**
   * Whether it carries a close control.
   *
   * Default is closable: a document tab that cannot be closed is the exception
   * (a dashboard that is always open), and the exception is what should have
   * to be written down.
   */
  readonly closable?: boolean;
  readonly disabled?: boolean;
}

/** One step of a breadcrumb trail. The last one is the current page. */
export interface Crumb {
  /** Already translated by the consumer. */
  readonly label: string;
  /** Absent on the last crumb, which is where you already are. */
  readonly route?: string;
}

/**
 * How far the tree walks before the middle is folded away.
 *
 * Five, and the number comes from the case the sheet names: "Inicio / ... /
 * Ubicación A1-12-03". Up to four steps fit on one line at the narrowest
 * width the system supports and read as a path; past that the trail wraps and
 * stops being one. Four visible plus the fold is what five means here: the
 * first, the last, and the ellipsis between them.
 */
export const CRUMB_FOLD_THRESHOLD = 5;

/** Whether an item is a group -- it opens rather than going anywhere. */
export function isGroup(item: NavItem): boolean {
  return (item.children?.length ?? 0) > 0;
}

/**
 * Every item of the tree, flattened in visual order, honouring what is open.
 *
 * The roving-focus keyboard of a treeview moves between VISIBLE rows, so the
 * order it walks is this list and not the tree. Written once here rather than
 * inside the rail and again inside the bottom bar: the two draw the same tree
 * and must agree about what "the next item" means.
 */
export function visibleItems(
  items: readonly NavItem[],
  openGroups: ReadonlySet<string>,
): readonly NavItem[] {
  const flat: NavItem[] = [];
  for (const item of items) {
    flat.push(item);
    if (isGroup(item) && openGroups.has(item.id)) {
      flat.push(...(item.children ?? []));
    }
  }
  return flat;
}

/** The group holding `id`, or null when `id` is top level or unknown. */
export function parentOf(items: readonly NavItem[], id: string): NavItem | null {
  for (const item of items) {
    if (item.children?.some((child) => child.id === id) === true) {
      return item;
    }
  }
  return null;
}

/**
 * Which crumbs to draw, and which the fold hides.
 *
 * Returns the whole trail when it is short enough or the fold is open. The
 * first and the last are never hidden: the first is where you came from and
 * the last is where you are, and a trail that hides either has stopped being
 * a trail.
 */
export function foldCrumbs(
  crumbs: readonly Crumb[],
  expanded: boolean,
): { readonly visible: readonly Crumb[]; readonly folded: number } {
  const first = crumbs[0];
  const last = crumbs[crumbs.length - 1];
  if (expanded || crumbs.length < CRUMB_FOLD_THRESHOLD || first === undefined || last === undefined) {
    return { visible: crumbs, folded: 0 };
  }
  return { visible: [first, last], folded: crumbs.length - 2 };
}
