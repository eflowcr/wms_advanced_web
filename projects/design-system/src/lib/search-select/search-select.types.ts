/**
 * The four states a person can see, from RFE-03 of REQ-FE-DS3-001, plus the
 * two that are not states of the search at all.
 *
 * `empty` AND `error` ARE DIFFERENT VALUES AND THE REQ IS EXPLICIT ABOUT WHY:
 * confusing them makes a service outage look like an empty warehouse, which is
 * the worst possible reading on a warehouse floor. They never collapse into a
 * shared "nothing to show" branch.
 */
export type SearchStatus =
  /** Nothing typed yet, or the text was cleared. */
  | 'idle'
  /** A query is in flight. */
  | 'searching'
  /** Results are on screen. */
  | 'ready'
  /** The query came back with nothing. NOT an error. */
  | 'empty'
  /** The source failed or ran out of time. NOT an absence of records. */
  | 'error';

/** The tokens the component reads at runtime. See lib/tokens/read-token.ts. */
export const DELAY_SEARCH_INPUT_TOKEN = '--delay-search-input';
export const TIMEOUT_SEARCH_TOKEN = '--timeout-search';
export const SCAN_THRESHOLD_TOKEN = '--threshold-scan-keystroke';

/**
 * How many keystrokes in a row have to arrive under the threshold before a
 * run counts as a scan.
 *
 * Two is not enough: two fast keys happen when somebody types "SK" with both
 * hands. A barcode is never two characters, so asking for four costs a real
 * scan nothing and keeps a fast typist from being mistaken for a gun.
 */
export const SCAN_MIN_KEYSTROKES = 4;

/**
 * The rows that are not results: the spinner, the empty note, the "load more".
 *
 * They share the row geometry of a result so the list does not jump when one
 * replaces the other, and they are `text-secondary` because none of them is
 * content -- they are the list talking about itself.
 */
export const SEARCH_NOTE_CLASSES = 'flex items-center gap-2 px-3 py-1.5 text-caption text-secondary';

/**
 * The "load more" row.
 *
 * It is a ROW IN THE LIST, not a button beside it, and that is what makes it
 * keyboard-reachable without a tab stop of its own: the arrow keys walk onto
 * it like any other row and Enter activates it. A `<button>` in the panel
 * would need the focus, and the focus is not allowed to leave the field.
 */
export const SEARCH_MORE_CLASSES =
  'flex w-full items-center justify-center gap-2 px-3 py-1.5 cursor-pointer text-caption ' +
  'text-(color:--color-bg-primary)';
