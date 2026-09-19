import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * One row of the property table.
 *
 * `default` is a string and not the value itself: what belongs in the column
 * is the literal a reader would type, so `'md'` keeps its quotes and `null`
 * stays the word null.
 */
export interface PropRow {
  readonly name: string;
  readonly type: string;
  readonly default: string;
  readonly description: string;
}

/**
 * Widget 5.2 — the property table.
 *
 * Static on purpose. It was specified as a live panel (a switch per boolean, a
 * select per enum, rewriting the snippet) and was downgraded to a table: the
 * state matrix already renders every combination, the IDE already shows the
 * types, and for a tool consulted once per component the table is enough
 * (Showroom spec, 5.2).
 *
 * The rows are written by hand and MUST be checked against the component's
 * real signature -- not against its sheet in the vault. Where the two
 * disagree, the code wins and the sheet is what gets corrected.
 */
@Component({
  selector: 'ewms-prop-table',
  templateUrl: './prop-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropTable {
  readonly rows = input.required<readonly PropRow[]>();
  readonly caption = input.required<string>();
}
