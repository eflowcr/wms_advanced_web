/**
 * THE ONE PLACE THAT TELLS A PERSON FROM A BARCODE GUN.
 *
 * A barcode reader presents itself to the operating system as a keyboard. It
 * emits the characters of a code one at a time and closes with Enter, and it
 * does so far faster than any hand: an industrial reader sits around 5-20 ms
 * per character, a very fast typist around 120 ms. `--threshold-scan-keystroke`
 * is where the line is drawn, and it is a token rather than a number in here
 * because the model of reader on the warehouse floor is not known yet
 * (REQ-FE-DS4-001 RFE-06).
 *
 *
 * WHY THIS IS A CLASS WITH NO FRAMEWORK IN IT
 *
 * It started inside `ewms-search-select`, which needed it first, and DS-4
 * needed the same measurement for the global shortcut engine. Two
 * implementations of "is this a gun?" is the one duplication this system
 * cannot afford: they would drift, and the half that drifted would fire a
 * shortcut in the middle of a scan -- which on a warehouse floor is a wrong
 * inventory movement, not an interface annoyance.
 *
 * So it lives here, it takes the threshold and the clock as arguments, and it
 * is tested on its own with simulated times at both sides of the line. Neither
 * consumer owns it and neither can quietly change it.
 */

/**
 * How many keystrokes in a row have to arrive under the threshold before a run
 * counts as a scan.
 *
 * Two is not enough: two fast keys happen when somebody types "SK" with both
 * hands. A barcode is never two characters, so asking for four costs a real
 * scan nothing and keeps a fast typist from being mistaken for a gun.
 */
export const SCAN_MIN_KEYSTROKES = 4;

/** The token the consumers read to get the threshold. See tokens/read-token.ts. */
export const SCAN_THRESHOLD_TOKEN = '--threshold-scan-keystroke';

/**
 * What one keystroke turned out to be.
 *
 * `burst` and `scan` are different answers to different questions: `burst`
 * means "this key belongs to a run that is still open, do not act on it", and
 * `scan` means "the run closed on Enter and here is the whole code". A
 * consumer that only cares about suppressing shortcuts uses the first; one
 * that wants the code uses the second.
 */
export type ScanVerdict =
  /** An ordinary keystroke. A shortcut may act on it. */
  | { readonly kind: 'key' }
  /** Inside a run that is fast enough to be a gun. NOTHING may act on it. */
  | { readonly kind: 'burst' }
  /** A qualifying run closed on Enter. The code is complete. */
  | { readonly kind: 'scan'; readonly code: string };

const KEY: ScanVerdict = { kind: 'key' };
const BURST: ScanVerdict = { kind: 'burst' };

/**
 * One run of keystrokes, measured.
 *
 * One instance per surface that listens: the global engine has one, and each
 * `ewms-search-select` has its own. They must not share, because two fields
 * on one screen are two independent runs.
 */
export class ScanDetector {
  /** The characters of the run currently open, in order. */
  private run: string[] = [];
  /** When the last printable key of the run arrived. */
  private lastKeystroke = 0;

  /**
   * Fold one keydown into the run and say what it was.
   *
   * @param threshold Milliseconds, from `--threshold-scan-keystroke`, or
   *   `null` when the stylesheet does not declare it. With no threshold
   *   nothing can be classified as a scan -- the surface still works, it just
   *   never resolves one. No fallback number lives here, for the reason
   *   read-token.ts gives.
   * @param now The clock, injectable so the unit test can simulate times
   *   rather than sleep. `Date.now()` in production.
   */
  accept(event: KeyboardEvent, threshold: number | null, now: number = Date.now()): ScanVerdict {
    if (event.key === 'Enter') {
      const code = this.run.join('');
      const long = this.run.length >= SCAN_MIN_KEYSTROKES;
      this.reset();
      return long && threshold !== null ? { kind: 'scan', code } : KEY;
    }

    /*
     * A GUN SENDS NO MODIFIERS AND NO NAMED KEYS, AND BOTH HALVES MATTER.
     *
     * `key.length !== 1` catches ArrowDown, Escape, Tab and Shift: a run
     * containing one of those was a person, so it breaks. That was found by
     * the end-to-end walk of the search select page, where HOLDING the down
     * arrow repeats every 30-odd milliseconds and arrived at Enter looking
     * exactly like a scan.
     *
     * The modifier check is the same argument one level up: nothing a reader
     * emits is held down with Ctrl or Alt, so a combination is proof of a
     * person. It also means Alt+N and Ctrl+S never need to wait to be sure.
     */
    if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
      this.reset();
      return KEY;
    }

    if (threshold === null) {
      this.reset();
      return KEY;
    }

    const gap = now - this.lastKeystroke;
    this.lastKeystroke = now;
    // A single slow gap starts the run over. That is what keeps a person who
    // types a fast burst, pauses, and then types more from accumulating one
    // long run across the pause -- and it is why the code carried out of a
    // scan is the run's characters and not everything typed since the page
    // loaded.
    this.run = gap <= threshold ? [...this.run, event.key] : [event.key];

    return this.run.length >= SCAN_MIN_KEYSTROKES ? BURST : KEY;
  }

  /**
   * How many characters the open run holds.
   *
   * Read by a consumer that has to decide something about the run without
   * feeding it a key -- there is one, and it is the search select deciding
   * whether its Enter closes a scan or chooses the active row.
   */
  get length(): number {
    return this.run.length;
  }

  /** Forget the open run. Called when the surface loses the focus. */
  reset(): void {
    this.run = [];
    this.lastKeystroke = 0;
  }
}
