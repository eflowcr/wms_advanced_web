import {
  Component,
  ChangeDetectionStrategy,
  contentChild,
  Directive,
  inject,
  input,
  TemplateRef,
} from '@angular/core';
import type { BadgeDictionary, TableColumnType, TableColumnWidth } from './table.types';

/** What an `ewmsCell` template receives. */
export interface CellContext<T> {
  readonly $implicit: T;
  readonly value: unknown;
}

/**
 * The escape hatch, and DELIBERATELY NOT THE MAIN ROAD.
 *
 * Five column types cover what a WMS table actually shows, and each of them
 * brings its own cell. This exists for the sixth thing -- a cell with a
 * tooltip, a link, two lines -- and it is a directive rather than an input so
 * that reaching for it looks like what it is: writing a template.
 */
@Directive({ selector: '[ewmsCell]' })
export class CellTemplate<T = unknown> {
  readonly template = inject<TemplateRef<CellContext<T>>>(TemplateRef);

  /** Lets the compiler type `let-row` and `value` inside the template. */
  static ngTemplateContextGuard<T>(
    _directive: CellTemplate<T>,
    _context: unknown,
  ): _context is CellContext<T> {
    return true;
  }
}

/**
 * One column, DECLARED rather than configured.
 *
 * It renders nothing: the table queries these as content children and draws
 * the grid itself. A column that rendered its own cells would need the table
 * to hand it the row, the row to hand it back the width, and the two would
 * fight over which of them owns the `<tr>`.
 *
 * The declarative form is the whole point of the API. An array of column
 * objects in TypeScript reads as configuration; six lines of markup read as a
 * table, and a reviewer can see the columns in the order they will appear.
 */
@Component({
  selector: 'ewms-column',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableColumn {
  /**
   * Which property of the row this column shows. A property NAME, not a path:
   * a path needs a parser and the escape hatch for anything deeper is already
   * `ewmsCell`, where the consumer writes Angular instead of a mini-language.
   *
   * It is also the key this column's filter travels under in `TableQuery`, and
   * what `aria-sort` is keyed by.
   */
  readonly key = input.required<string>();

  /** The heading, already translated. Empty is legitimate for `actions`. */
  readonly header = input<string>('');

  /**
   * Decides four things at once: alignment, typography, which cell is drawn,
   * and WHAT SHAPE ITS FILTER TAKES. A number column filters with two numbers,
   * a date column with two dates.
   */
  readonly type = input<TableColumnType>('text');

  readonly width = input<TableColumnWidth>('fill');

  readonly sortable = input<boolean>(false);

  readonly filterable = input<boolean>(false);

  /**
   * Only for `type="badge"`. THE CENTRAL DICTIONARY: the badge draws from it,
   * and `rowState="<this column's key>"` reads the same object to tint the
   * row, so the two can never disagree.
   */
  readonly badges = input<BadgeDictionary>({});

  readonly cell = contentChild(CellTemplate);
}
