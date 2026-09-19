import type { Observable } from 'rxjs';
import type { IconName } from '../../icons/icons.generated';
import type { SemanticFamily } from '../feedback/feedback.types';

/**
 * What a row's state is worth, named by the COLOUR FAMILY.
 *
 * Not by a message vocabulary: nobody says "an info row". The four are the
 * same four families the Banner and the Toast paint with, so a person who
 * learns what the crossed circle means in a toast finds it again in a row.
 */
export type RowState = SemanticFamily;

/** What a value in a `badge` column turns into. */
export interface BadgeDescriptor {
  readonly variant: RowState;
  /** The words, already translated (ADR 0008). */
  readonly label: string;
}

/**
 * THE CENTRAL DICTIONARY, and the reason the row tint and the badge cannot
 * disagree.
 *
 * One object maps a raw value to a variant and a label; the `badge` column
 * draws from it, and `rowState="<key>"` reads the same object to tint the row.
 * The alternative the sheet forbids in as many words -- a class per view -- is
 * how one screen ends up calling "Con incidencia" red and another amber.
 */
export type BadgeDictionary = Readonly<Record<string, BadgeDescriptor>>;

export type TableColumnType = 'text' | 'number' | 'date' | 'badge' | 'actions';

/**
 * A column's width, BY NAME.
 *
 * Never a CSS string: gate 10 rejects a raw length in a template anyway, and a
 * name is what keeps six tables in one application from each inventing their
 * own column widths. `fill` is the odd one out and is not a token -- it is
 * `flex: 1`, "take what is left".
 */
export type TableColumnWidth = 'sm' | 'md' | 'lg' | 'fill';

/** Where the children of a row come from, when they are not a property. */
export type TableChildren<T> = (row: T) => readonly T[] | Observable<readonly T[]> | null;

/** One entry of a row's context menu. */
export interface MenuItem {
  readonly id: string;
  /** Already translated. */
  readonly label: string;
  readonly icon?: IconName;
  /** `danger` paints it as the destructive answer. Nothing else is coloured. */
  readonly tone?: 'danger';
  readonly separatorBefore?: boolean;
  readonly disabled?: boolean;
}

/** What `(rowActivate)` carries. An object, so a second field can arrive later. */
export interface RowActivateEvent<T> {
  readonly row: T;
}

/** What `(rowMenu)` carries. */
export interface RowMenuEvent<T> {
  readonly row: T;
  readonly item: MenuItem;
}

/** 40 px and 32 px, from the tokens. See `--row-height-*`. */
export type TableDensity = 'md' | 'sm';

export const ROW_HEIGHT: Readonly<Record<TableDensity, string>> = {
  md: 'var(--row-height-md)',
  sm: 'var(--row-height-sm)',
};

/**
 * Column widths as inline styles rather than utilities.
 *
 * A `<col>`'s width is one declaration and there is no theme namespace for it;
 * the tokens are what keep the values out of the template.
 */
export const COLUMN_WIDTH: Readonly<Record<Exclude<TableColumnWidth, 'fill'>, string>> = {
  sm: 'var(--col-width-sm)',
  md: 'var(--col-width-md)',
  lg: 'var(--col-width-lg)',
};

/**
 * Alignment and typography per column type.
 *
 * NUMBERS RIGHT AND MONO, and that is not decoration: two quantities are only
 * comparable at a glance when their digits line up, and they only line up in a
 * monospaced face flushed to the same edge. Dates are mono for the same reason
 * and start-aligned because they are read, not compared.
 */
export function columnCellClasses(type: TableColumnType): string {
  switch (type) {
    case 'number':
      return 'text-end font-mono';
    case 'date':
      return 'text-start font-mono';
    case 'actions':
      return 'text-end';
    default:
      return 'text-start';
  }
}

/** The header follows its column's alignment, or a sort arrow lands in the wrong place. */
export function columnHeaderClasses(type: TableColumnType): string {
  return type === 'number' || type === 'actions' ? 'justify-end' : 'justify-start';
}

/**
 * The box.
 *
 * `border-separate` is deliberately NOT used: a collapsed border is what lets
 * a row's tint reach the edge of its cells without a seam between them.
 */
export const TABLE_CLASSES = 'w-full border-collapse text-p';

export const HEADER_CELL_CLASSES =
  'border-b border-strong bg-secondary px-3 text-caption text-secondary';

/**
 * A cell, INCLUDING ITS FOCUS RING -- and the ring is an outline rather than
 * the system's usual box-shadow.
 *
 * The shadow token paints two bands three pixels out, which on a
 * border-collapse table lands on top of the neighbouring cells: the focused
 * cell would appear to have a halo over its neighbours' content. An outline is
 * drawn on the element's own edge and does not bleed.
 *
 * It is still the system's focus colour, from the same token. The icon grid in
 * the showroom made the same call for the same reason, and the keyboard walk
 * in e2e/showroom.e2e.ts accepts either -- what it refuses is a control with
 * no ring at all, or one falling back to the browser's own.
 *
 * NOTE THE ABSENCE OF `outline-none`, which every other control in this
 * library pairs with its ring. In Tailwind v4 that utility sets a variable the
 * later outline utilities read, so `outline-none` followed by a focus-visible
 * outline resolves to no outline at all -- the ring silently disappears and
 * the browser's own `outline-style: auto` shows through instead. The keyboard
 * walk caught exactly that. The icon grid, which arrived at this pattern
 * first, does not use it either.
 */
export const CELL_CLASSES =
  'border-b border-default px-3 align-middle text-primary ' +
  'focus-visible:outline-2 focus-visible:outline-focus';

/**
 * A row that can be walked, and the three things it can be.
 *
 * SELECTED WINS OVER THE STATE TINT. A row that is both "con incidencia" and
 * selected shows it is selected, because the state is already said twice -- by
 * the badge's icon and by its words -- while the selection is said by the tint
 * and the checkbox alone.
 */
export function rowClasses(selected: boolean, tint: string): string {
  const base = 'group';
  if (selected) {
    return `${base} bg-row-selected`;
  }
  return tint ? `${base} ${tint}` : `${base} hover:bg-ghost-hover`;
}
