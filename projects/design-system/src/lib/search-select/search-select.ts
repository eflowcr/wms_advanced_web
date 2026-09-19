import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, timer } from 'rxjs';
import { catchError, debounce, map, switchMap, tap, timeout } from 'rxjs/operators';
import {
  FIELD_BASE_CLASSES,
  FIELD_FONT_SIZES,
  FIELD_HEIGHT_CLASSES,
  FIELD_PADDING_CLASSES,
  fieldBorderColor,
  fieldSurfaceClasses,
  type FieldSize,
  type FieldState,
} from '../field/field.types';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { Icon } from '../icon/icon';
import {
  LISTBOX_PANEL_CLASSES,
  LISTBOX_SELECTED_WEIGHT,
  listboxOptionClasses,
  moveActiveIndex,
} from '../listbox/listbox.types';
import { createConnectedOverlay, PANEL_POSITIONS } from '../overlay/connected-overlay';
import { readMilliseconds } from '../tokens/read-token';
import {
  DELAY_SEARCH_INPUT_TOKEN,
  SCAN_MIN_KEYSTROKES,
  SCAN_THRESHOLD_TOKEN,
  SEARCH_MORE_CLASSES,
  SEARCH_NOTE_CLASSES,
  TIMEOUT_SEARCH_TOKEN,
  type SearchStatus,
} from './search-select.types';
import type { SearchDisplay, SearchSource } from './search-source';

export type { SearchDisplay, SearchPage, SearchSource } from './search-source';
export type { SearchStatus } from './search-select.types';

let nextSearchSelectId = 0;

/** One query, with everything the pipeline needs to run and to retry it. */
interface SearchRequest {
  readonly query: string;
  readonly page: number;
  /** Append to what is on screen, rather than replacing it. */
  readonly append: boolean;
  /** Came from a scanner burst: resolve without opening the panel if it can. */
  readonly scan: boolean;
}

/**
 * A field you type into, that filters against a source as you type.
 *
 * IT IS NOT A BETTER `ewms-select`, IT IS THE OPPOSITE CASE. The Select is for
 * a closed, short list you open and walk. A warehouse has tens of thousands of
 * SKUs and thousands of locations: opening a panel and walking it with the
 * arrows is not a slow option, it is an impossible one. What an operator needs
 * is a box to type into that narrows itself -- and, far more often, a barcode
 * read with a gun that resolves without touching anything at all.
 *
 * Both components stay. This one does not replace that one.
 *
 *
 * WHAT IS SHARED, AND WHY IT HAD TO BE (HG-04)
 *
 * The overlay is `overlay/connected-overlay.ts`, the same one the Select and
 * the Tooltip use. The panel, the rows and the arrow-key movement are
 * `listbox/`, extracted from the Select in this same change so there is one of
 * each rather than two. REQ-FE-DS3-001 makes that a hard gate, and the reason
 * is not tidiness: "does the list wrap at the end" is exactly the kind of
 * question two copies answer differently six months apart.
 *
 *
 * THE VALUE IS THE RECORD, NOT THE TEXT
 *
 * `ControlValueAccessor` through `FormControlBase`, like every other control
 * here. The text is internal state; the form receives the chosen record. A
 * form that received the text would be a form that cannot tell "SKU-881" typed
 * and abandoned from "SKU-881" actually chosen.
 */
@Component({
  selector: 'ewms-search-select',
  templateUrl: './search-select.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [provideValueAccessor(() => SearchSelect)],
})
export class SearchSelect<T> extends FormControlBase<T | null> implements OnDestroy {
  /**
   * Where the records come from. An INTERFACE, never an endpoint: this
   * component knows nothing about HTTP, and moving from the demo source to a
   * real backend changes an implementation of `SearchSource` and nothing else.
   */
  readonly source = input.required<SearchSource<T>>();

  /** How a record becomes text, and how a scanned code is matched against it. */
  readonly display = input.required<SearchDisplay<T>>();

  /** The chosen record. Seeds the control; `writeValue` takes over after that. */
  readonly value = input<T | null>(null);

  readonly size = input<FieldSize>('md');

  /** Required and visible, for the same reason as every other field's. */
  readonly label = input.required<string>();

  readonly placeholder = input<string>('');

  /** Help text under the field. Turns danger-coloured when `error`. */
  readonly hint = input<string>('');

  /** Purely visual. This component validates nothing; the parent form decides. */
  readonly error = input<boolean>(false);

  /**
   * The words for the states the component can show. They arrive already
   * translated -- the design system speaks no language (ADR 0008) -- and there
   * is no default, because a default would be a language.
   *
   * `noResults` receives the text that was searched, so the message can repeat
   * it as RFE-03 requires.
   */
  readonly messages = input.required<SearchSelectMessages>();

  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef: OverlayRef | null = null;

  private readonly id = ++nextSearchSelectId;
  protected readonly fieldId = `ewms-search-select-${this.id}`;
  protected readonly labelId = `${this.fieldId}-label`;
  protected readonly listboxId = `${this.fieldId}-listbox`;
  protected readonly hintId = `${this.fieldId}-hint`;
  protected readonly statusId = `${this.fieldId}-status`;
  protected readonly errorId = `${this.fieldId}-error`;

  protected readonly valueSource = this.value;

  protected readonly text = signal('');
  protected readonly items = signal<readonly T[]>([]);
  protected readonly status = signal<SearchStatus>('idle');
  protected readonly hasMore = signal(false);
  protected readonly total = signal<number | null>(null);
  protected readonly isOpen = signal(false);
  protected readonly activeIndex = signal(-1);

  /** The query the panel is showing, for the "no results for X" message. */
  protected readonly searchedText = signal('');

  /** The last request, so the retry can repeat it exactly (RFE-04). */
  private lastRequest: SearchRequest | null = null;

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly panelClasses = LISTBOX_PANEL_CLASSES;
  protected readonly noteClasses = SEARCH_NOTE_CLASSES;
  protected readonly moreClasses = SEARCH_MORE_CLASSES;
  protected readonly selectedWeight = LISTBOX_SELECTED_WEIGHT;

  /** Typed text, before the delay. */
  private readonly typed = new Subject<string>();
  /** Queries, after the delay or straight from a scan. */
  private readonly requests = new Subject<SearchRequest>();

  // ---------------------------------------------------------- scan detection

  /** When the previous keystroke arrived, and how many arrived fast in a row. */
  private lastKeystroke = 0;
  private burstLength = 0;

  /**
   * A scan already searched for this text, so the delayed query behind it is
   * stale before it fires.
   *
   * Without this, a scan resolves, chooses its record, and then the debounce
   * timer left over from the burst's own keystrokes fires and reopens the
   * panel over a field that is already finished. The bug only appears with a
   * real gun, which is exactly the kind that reaches production.
   */
  private scanHandled = false;

  constructor() {
    super();

    /*
     * RFE-01: between the last key and the query there is a delay, and it is a
     * token rather than a number in the code. `debounce` with a timer rather
     * than `debounceTime`, because the token is read per emission: a page that
     * redefines it does not need the component remounted.
     *
     * When the token is missing the wait is zero -- one query per keystroke,
     * noisy but correct -- rather than a constant invented here. Same rule as
     * the Toast's duration: no fallback number lives in TypeScript.
     */
    this.typed
      .pipe(
        debounce(() => timer(readMilliseconds(DELAY_SEARCH_INPUT_TOKEN) ?? 0)),
        takeUntilDestroyed(),
      )
      .subscribe((query) => {
        if (this.scanHandled) {
          this.scanHandled = false;
          return;
        }
        this.request({ query, page: 0, append: false, scan: false });
      });

    /*
     * RFE-01 again, and this is the half that matters: `switchMap` CANCELS the
     * query in flight when a newer one starts. Without it a slow page 0 can
     * land after a fast page 0 for different text and paint stale results over
     * fresh ones -- the failure PACQ-01.2 is written to catch.
     */
    this.requests
      .pipe(
        tap((request) => this.onRequestStart(request)),
        switchMap((request) => this.run(request)),
        takeUntilDestroyed(),
      )
      .subscribe();

    /*
     * WHAT IS IN THE BOX FOLLOWS THE VALUE, AND THERE IS ONE SOURCE OF TRUTH.
     *
     * `text` is what the field shows; this is the only place the form gets to
     * write it. Binding the field to `chosen ?? typed` instead looks simpler
     * and is wrong: after choosing once, every later keystroke would be
     * overwritten by the old label.
     *
     * `controlValue` changes exactly twice -- when the form writes one and
     * when the person chooses one -- so this never fights with typing.
     */
    effect(() => {
      const chosen = this.controlValue();
      this.text.set(chosen === null ? '' : this.display().label(chosen));
    });
  }

  ngOnDestroy(): void {
    this.close();
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  // -------------------------------------------------------------- appearance

  protected readonly effectiveState = computed<FieldState>(() => {
    if (this.isDisabled()) {
      return 'disabled';
    }
    return this.error() || this.status() === 'error' ? 'error' : 'default';
  });

  protected readonly borderColor = computed(() =>
    fieldBorderColor(this.effectiveState(), this.isOpen()),
  );

  protected readonly fieldClasses = computed(() =>
    [
      this.baseClasses,
      FIELD_HEIGHT_CLASSES[this.size()],
      FIELD_PADDING_CLASSES[this.size()],
      fieldSurfaceClasses(this.effectiveState()),
    ].join(' '),
  );

  protected readonly fontSize = computed(() => FIELD_FONT_SIZES[this.size()]);

  protected readonly hintClasses = computed(() =>
    this.effectiveState() === 'error' ? 'text-danger' : 'text-secondary',
  );

  protected readonly describedBy = computed(() => {
    const ids = [this.statusId];
    if (this.hint()) {
      ids.push(this.hintId);
    }
    if (this.status() === 'error') {
      ids.push(this.errorId);
    }
    return ids.join(' ');
  });

  protected readonly controlsId = computed(() => (this.isOpen() ? this.listboxId : null));

  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.isOpen() && index >= 0 ? this.optionId(index) : null;
  });

  /**
   * How many rows the arrow keys can reach: the results, plus the "load more"
   * row when there is one. That row is reachable by keyboard BECAUSE it is
   * counted here -- it is a row in the list, not a button beside it.
   */
  protected readonly rowCount = computed(() => this.items().length + (this.hasMore() ? 1 : 0));

  protected isMoreRow(index: number): boolean {
    return this.hasMore() && index === this.items().length;
  }

  protected optionId(index: number): string {
    return `${this.fieldId}-option-${index}`;
  }

  protected optionClasses(index: number): string {
    return listboxOptionClasses(false, index === this.activeIndex());
  }

  protected labelOf(item: T): string {
    return this.display().label(item);
  }

  /**
   * What the live region says. RFE-08: a screen reader has to learn that the
   * list changed without the focus moving, because the focus never moves.
   */
  protected readonly announcement = computed(() => {
    const messages = this.messages();
    switch (this.status()) {
      case 'searching':
        return messages.searching;
      case 'empty':
        return messages.noResults(this.searchedText());
      case 'error':
        return messages.error;
      case 'ready':
        return messages.results(this.items().length, this.total());
      case 'idle':
        return '';
    }
  });

  // ------------------------------------------------------------- the queries

  private request(request: SearchRequest): void {
    this.requests.next(request);
  }

  private onRequestStart(request: SearchRequest): void {
    this.lastRequest = request;
    this.searchedText.set(request.query);
    this.status.set('searching');
    if (!request.append) {
      /*
       * EVERYTHING ABOUT THE PREVIOUS ANSWER GOES, NOT JUST THE ROWS.
       *
       * `hasMore` left over from the last query kept the "load more" row on
       * screen while a new search was in flight -- a row offering page 2 of a
       * search that no longer exists. Found by PACQ-04.2, which counts the
       * rows after the text changes.
       */
      this.items.set([]);
      this.hasMore.set(false);
      this.total.set(null);
      this.activeIndex.set(-1);
    }
    // A scan resolves without the panel when it can, so it does not open one
    // on the way. Everything else opens: RFE-01 says the person never has to.
    if (!request.scan) {
      this.open();
    }
  }

  /**
   * Run one request. NEVER ERRORS: a failure becomes the error STATE, because
   * an error that escapes the pipeline would kill the subscription and leave
   * the component unable to search again.
   */
  private run(request: SearchRequest) {
    const waited = readMilliseconds(TIMEOUT_SEARCH_TOKEN);
    const query = this.source().search(request.query, request.page);
    return (waited === null ? query : query.pipe(timeout({ first: waited }))).pipe(
      map((page) => {
        this.items.update((current) =>
          request.append ? [...current, ...page.items] : [...page.items],
        );
        this.hasMore.set(page.hasMore);
        this.total.set(page.total);
        this.status.set(this.items().length === 0 ? 'empty' : 'ready');
        this.afterResults(request);
        return page;
      }),
      /*
       * RFE-02: a timeout is an ERROR OF THE SERVICE, not an absence of
       * records. The two never share a branch -- confusing them makes an
       * outage look like an empty warehouse.
       */
      catchError(() => {
        this.status.set('error');
        // The panel has nothing to show, and the error is rendered under the
        // field where Tab reaches its retry button (PACQ-03.2).
        this.close();
        return EMPTY;
      }),
    );
  }

  /**
   * RFE-06: a scan that identified exactly one record chooses it, without the
   * panel ever having been opened. Anything else -- several matches, none, or
   * a match that is not exact -- behaves like an ordinary search.
   */
  private afterResults(request: SearchRequest): void {
    if (!request.scan) {
      return;
    }
    const code = this.display().code;
    const only = this.items().length === 1 ? this.items()[0] : undefined;
    if (only !== undefined && code && equalsIgnoringCase(code(only), request.query)) {
      this.choose(only);
      return;
    }
    this.open();
  }

  // ------------------------------------------------------------- open/close

  protected open(): void {
    if (this.isDisabled() || this.isOpen()) {
      return;
    }
    const overlayRef = (this.overlayRef ??= this.createOverlay());
    overlayRef.updateSize({ width: this.field().nativeElement.getBoundingClientRect().width });
    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);
  }

  private createOverlay(): OverlayRef {
    const overlayRef = createConnectedOverlay(
      this.injector,
      this.field().nativeElement,
      PANEL_POSITIONS,
    );
    overlayRef.outsidePointerEvents().subscribe(() => this.close());
    return overlayRef;
  }

  /** Close WITHOUT touching the value. Every exit goes through here. */
  protected close(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  // ---------------------------------------------------------------- typing

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    if (value === '') {
      // Clearing the box is not a search. RFE-03: it also does not clear the
      // chosen value -- only picking another record does that.
      this.status.set('idle');
      this.items.set([]);
      this.hasMore.set(false);
      this.close();
      return;
    }
    this.typed.next(value);
  }

  /**
   * RFE-06, first half: recognise a burst.
   *
   * The measurement is local and the threshold is a token. The REQ allows
   * exactly this -- the design system may not import `core/keyboard/`, so it
   * either receives the event already classified or measures the gaps itself.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }

    const isScan = event.key === 'Enter' && this.burstLength >= SCAN_MIN_KEYSTROKES;
    this.trackKeystroke(event);

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.isOpen()) {
          this.activeIndex.set(moveActiveIndex(this.activeIndex(), 1, this.rowCount()));
        } else if (this.text()) {
          this.open();
        }
        return;

      case 'ArrowUp':
        event.preventDefault();
        if (this.isOpen()) {
          this.activeIndex.set(moveActiveIndex(this.activeIndex(), -1, this.rowCount()));
        }
        return;

      case 'Enter':
        if (isScan) {
          /*
           * A burst ending in Enter searches IMMEDIATELY, without the input
           * delay: waiting 300 ms after a gun has already delivered the whole
           * code is 300 ms of an operator standing still.
           */
          event.preventDefault();
          this.scanHandled = true;
          this.request({ query: this.text(), page: 0, append: false, scan: true });
          return;
        }
        if (this.isOpen() && this.activeIndex() >= 0) {
          event.preventDefault();
          this.activate(this.activeIndex());
        }
        // Otherwise Enter belongs to the form around the field. Swallowing it
        // would break submitting a form from the keyboard.
        return;

      case 'Escape':
        if (this.isOpen()) {
          // Dismissal and nothing else: the value does not change, and the
          // focus is already on the field and stays there.
          event.preventDefault();
          this.close();
        }
        return;

      case 'Tab':
        this.close();
        return;

      default:
        return;
    }
  }

  /**
   * A run of keystrokes counts as a burst while every gap stays under the
   * threshold. One slow gap resets it -- which is what makes a person typing
   * fast and then pausing not look like a gun.
   *
   *
   * ONLY PRINTABLE KEYS COUNT, AND THAT IS NOT AN OPTIMISATION.
   *
   * A gun sends the characters of a code and then Enter. It never sends an
   * arrow, an Escape or a Tab. Counting those made a keyboard user walking the
   * list fast -- or simply HOLDING the down arrow, which repeats every 30 ms or
   * so -- arrive at Enter with a burst behind them, and their Enter was read as
   * a scan instead of as "choose this row".
   *
   * Found by the end-to-end walk of this page, where four key presses in a row
   * take no time at all. A person can do the same thing with one finger.
   */
  private trackKeystroke(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.burstLength = 0;
      return;
    }
    // `key` is one character exactly when the key produced one. Everything
    // else -- ArrowDown, Escape, Tab, Shift -- breaks the run.
    if (event.key.length !== 1) {
      this.burstLength = 0;
      this.lastKeystroke = 0;
      return;
    }
    const threshold = readMilliseconds(SCAN_THRESHOLD_TOKEN);
    const now = Date.now();
    const gap = now - this.lastKeystroke;
    this.lastKeystroke = now;
    if (threshold === null) {
      // No threshold declared, so nothing can be classified as a scan. The
      // field still works; it just never resolves one without the panel.
      this.burstLength = 0;
      return;
    }
    this.burstLength = gap <= threshold ? this.burstLength + 1 : 1;
  }

  // ---------------------------------------------------------------- choosing

  /** A row was activated: a result, or the "load more" row. */
  protected activate(index: number): void {
    if (this.isMoreRow(index)) {
      this.loadMore();
      return;
    }
    const item = this.items()[index];
    if (item !== undefined) {
      this.choose(item);
    }
  }

  /**
   * Commit a record and close. The only path that changes the value: Escape,
   * Tab and an outside click all end at `close()` instead.
   */
  protected choose(item: T): void {
    this.commit(item);
    this.close();
    this.markTouched();
  }

  /** RFE-05: the next page is APPENDED, never a replacement. */
  protected loadMore(): void {
    const request = this.lastRequest;
    if (!request || !this.hasMore()) {
      return;
    }
    this.request({ ...request, page: request.page + 1, append: true, scan: false });
  }

  /** RFE-04: repeat the last query, same text and same page. */
  protected retry(): void {
    if (this.lastRequest) {
      this.request({ ...this.lastRequest, scan: false });
    }
  }

  protected onOptionMousedown(event: MouseEvent): void {
    // The focus must not leave the field, and it moves on mousedown.
    event.preventDefault();
  }

  protected onOptionEnter(index: number): void {
    this.activeIndex.set(index);
  }

  /**
   * Leaving the field puts back what was actually chosen.
   *
   * Half-typed text left in the box while the form holds a different record is
   * a field that lies about its own value -- and clearing the box is NOT
   * clearing the value (RFE-03), so without this the two would disagree on
   * screen until the next keystroke.
   */
  protected onBlur(): void {
    const chosen = this.controlValue();
    this.text.set(chosen === null ? '' : this.display().label(chosen));
    this.markTouched();
  }

  /**
   * RFE-01: the panel appears on its own. Clicking the field reopens it when
   * there is something to show, so a person who clicked away and back does not
   * have to retype.
   */
  protected onFocus(): void {
    if (this.text() && this.items().length > 0) {
      this.open();
    }
  }
}

/** Every string the component can put on screen, already translated. */
export interface SearchSelectMessages {
  /** While a query is in flight. */
  readonly searching: string;
  /** Nothing matched. Receives the text searched, which RFE-03 requires shown. */
  readonly noResults: (query: string) => string;
  /** The source failed or ran out of time. */
  readonly error: string;
  /** The label of the retry action. */
  readonly retry: string;
  /** The label of the "load more" row. */
  readonly more: string;
  /**
   * Announced when results land. Receives how many are on screen and the
   * total the source reported, WHICH MAY BE NULL: RFE-02 makes `null` a
   * legitimate answer, and the message is where that shows.
   */
  readonly results: (count: number, total: number | null) => string;
}

/**
 * Exact match, ignoring case -- the definition REQ-FE-DS3-001 §8 gives for a
 * scanned code.
 *
 * Nothing else is normalised here. Control characters and padding that some
 * readers prepend are a declared open decision (§15), waiting on the real
 * hardware; guessing at it now would be a rule nobody could test.
 */
function equalsIgnoringCase(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
