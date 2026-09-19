import type { Observable } from 'rxjs';

/**
 * THE DATA CONTRACT OF `ewms-search-select` (REQ-FE-DS3-001, RFE-02).
 *
 * This interface is not an abstraction over an endpoint that exists. It is the
 * endpoint's specification, written before the endpoint, so that the component
 * is not built against a guess: the catalogue API of the WMS does not exist
 * yet (the Security Core starts in Sprint 1 of the product's Phase 0), and a
 * component built against an imagined contract is a component rewritten the
 * day the real one lands.
 *
 * THE COMPONENT KNOWS NOTHING ABOUT HTTP. No URL, no status code, no header,
 * no transport. Moving from the in-memory demo source to a real backend
 * changes an implementation of this interface and nothing else -- which is the
 * whole of the portability requirement in §5 of the REQ.
 */
export interface SearchSource<T> {
  /**
   * @param query The text exactly as it was typed. NOT normalised by the
   *   component: trimming, folding case or stripping accents are decisions
   *   about the data, and the source is what knows the data.
   * @param page Zero-based. A new text always asks for page 0.
   */
  search(query: string, page: number): Observable<SearchPage<T>>;
}

/** One page of results (REQ-FE-DS3-001, RFE-02). */
export interface SearchPage<T> {
  /** The records of this page, in the order they are shown. */
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  /**
   * How many records match in total, or `null` when the source does not know.
   *
   * `null` IS A LEGITIMATE ANSWER and the component has to work with it. A
   * source that counts rows to answer this is a source that pays for a count
   * on every keystroke, and plenty of real ones refuse to.
   */
  readonly total: number | null;
  /**
   * Whether at least one more page exists.
   *
   * EXPLICIT, AND NOT DERIVED FROM `total` -- precisely because `total` can be
   * null. Deriving it would make "load more" disappear for every source that
   * declines to count.
   */
  readonly hasMore: boolean;
}

/** The page size the component asks for, from RFE-02. */
export const SEARCH_PAGE_SIZE = 20;

/**
 * How the component turns a record into something a person reads and something
 * a scan can match.
 *
 * It is a pair of functions rather than a pair of property names, because the
 * value of this control is the RECORD -- an id, a code, an object, whatever
 * the consumer's domain uses -- and a property name would force every consumer
 * whose records do not have a `label` field into a wrapper type.
 */
export interface SearchDisplay<T> {
  /** The text shown in the panel and in the field once chosen. */
  label: (item: T) => string;
  /**
   * The code a barcode can carry. Used ONLY to decide whether a scan matched
   * exactly one record; never shown on its own.
   *
   * Optional: a source whose records have no code simply never resolves a scan
   * without opening the panel, which is the correct behaviour rather than a
   * degraded one.
   */
  code?: (item: T) => string;
}
