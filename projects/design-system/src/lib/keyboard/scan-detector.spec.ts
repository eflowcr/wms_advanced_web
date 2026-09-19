import { ScanDetector, SCAN_MIN_KEYSTROKES, type ScanVerdict } from './scan-detector';

/**
 * The barcode classifier, on its own, WITH A SIMULATED CLOCK.
 *
 * The threshold and the time are both arguments, so none of this sleeps and
 * none of it is flaky. That is the whole reason the measurement was pulled out
 * of `ewms-search-select`: inside a component it could only be tested by
 * driving a component, and "is 49 ms under the line and 51 ms over it" is a
 * question about arithmetic, not about a field.
 *
 * REQ-FE-DS4-001 RFE-05 and PACQ-03.1 to 03.4.
 */

const THRESHOLD = 50;

/** A keydown, reduced to the four properties the detector reads. */
function key(k: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key: k, ctrlKey: false, altKey: false, metaKey: false, ...modifiers } as KeyboardEvent;
}

/**
 * Feed a whole string at a fixed pace and return every verdict.
 *
 * The clock starts far from zero, because a detector that has never seen a key
 * has `lastKeystroke = 0` and the first gap is therefore enormous -- which is
 * correct, and which a test starting at `now = 0` would hide.
 */
function type(
  detector: ScanDetector,
  text: string,
  gap: number,
  start = 10_000,
): readonly ScanVerdict[] {
  return [...text].map((char, index) => detector.accept(key(char), THRESHOLD, start + index * gap));
}

describe('ScanDetector', () => {
  let detector: ScanDetector;

  beforeEach(() => {
    detector = new ScanDetector();
  });

  describe('a gun', () => {
    it('PACQ-03.1: a fast run closed by Enter is one scan carrying the whole code', () => {
      type(detector, 'EXP-000123', 5);
      const verdict = detector.accept(key('Enter'), THRESHOLD, 10_100);

      expect(verdict).toEqual({ kind: 'scan', code: 'EXP-000123' });
    });

    it('PACQ-03.2: a code CONTAINING a shortcut character never lets it through', () => {
      // The case the whole requirement exists for. `/` is the search shortcut.
      const verdicts = type(detector, 'AB/CD/EF', 5);

      // Everything from the fourth character on is inside a run, so nothing may
      // act on it -- the two slashes included.
      expect(verdicts.slice(SCAN_MIN_KEYSTROKES - 1).every((v) => v.kind === 'burst')).toBe(true);
      expect(detector.accept(key('Enter'), THRESHOLD, 10_100)).toEqual({
        kind: 'scan',
        code: 'AB/CD/EF',
      });
    });

    it('a code that BEGINS with a shortcut character still arrives whole', () => {
      /*
       * The first character of a run cannot be told from a person's keystroke,
       * and nothing here pretends otherwise: it comes back as `key`. What
       * stops the shortcut firing is the engine waiting one threshold window
       * before acting on a single character -- see keyboard-shortcuts.spec.ts.
       * What this asserts is that the CODE is not damaged by that.
       */
      const verdicts = type(detector, '/XY9012', 5);

      expect(verdicts[0]).toEqual({ kind: 'key' });
      expect(detector.accept(key('Enter'), THRESHOLD, 10_100)).toEqual({
        kind: 'scan',
        code: '/XY9012',
      });
    });

    it('exactly at the threshold counts as fast, one millisecond over does not', () => {
      type(detector, 'ABCD', THRESHOLD);
      expect(detector.accept(key('Enter'), THRESHOLD, 99_999)).toEqual({
        kind: 'scan',
        code: 'ABCD',
      });

      const slow = new ScanDetector();
      type(slow, 'ABCD', THRESHOLD + 1);
      expect(slow.accept(key('Enter'), THRESHOLD, 99_999)).toEqual({ kind: 'key' });
    });
  });

  describe('a person', () => {
    it('PACQ-03.3: typing fast and pressing Enter is not a scan', () => {
      // 150 ms between keys: quick, and nowhere near a gun.
      type(detector, 'SKU-881', 150);

      expect(detector.accept(key('Enter'), THRESHOLD, 20_000)).toEqual({ kind: 'key' });
    });

    it('PACQ-03.4: a fast run that does NOT end in Enter is never a scan', () => {
      const verdicts = type(detector, 'ABCDEF', 5);

      expect(verdicts.some((v) => v.kind === 'scan')).toBe(false);
      // Tab ends the run, and ends it as an ordinary key.
      expect(detector.accept(key('Tab'), THRESHOLD, 10_100)).toEqual({ kind: 'key' });
      expect(detector.length).toBe(0);
    });

    it('one slow gap starts the run over, and the code carries only what came after', () => {
      type(detector, 'XY', 5);
      // The pause. Everything before it belongs to a different run.
      detector.accept(key('Z'), THRESHOLD, 50_000);
      type(detector, 'ABC', 5, 50_005);

      expect(detector.accept(key('Enter'), THRESHOLD, 50_100)).toEqual({
        kind: 'scan',
        code: 'ZABC',
      });
    });

    it('holding an arrow key does not build a run', () => {
      /*
       * The regression this class was born with. Key repeat fires every 30 ms
       * or so, which is gun territory -- and a keyboard user walking a list
       * fast used to arrive at Enter with a burst behind them, so their "choose
       * this row" was read as a scan.
       */
      for (let i = 0; i < 10; i += 1) {
        expect(detector.accept(key('ArrowDown'), THRESHOLD, 10_000 + i * 30)).toEqual({
          kind: 'key',
        });
      }

      expect(detector.accept(key('Enter'), THRESHOLD, 10_400)).toEqual({ kind: 'key' });
    });

    it('a modifier breaks the run: a gun sends neither Ctrl nor Alt', () => {
      type(detector, 'ABC', 5);
      detector.accept(key('s', { ctrlKey: true }), THRESHOLD, 10_020);
      type(detector, 'DE', 5, 10_025);

      expect(detector.accept(key('Enter'), THRESHOLD, 10_100)).toEqual({ kind: 'key' });
    });
  });

  describe('with no threshold declared', () => {
    it('classifies nothing as a scan, and says so by returning ordinary keys', () => {
      // tokens.css not loaded. The surface still works; it just never resolves
      // a scan. Same contract as every other token read: no fallback number.
      const verdicts = type(detector, 'EXP-000123', 5).map((v) => v.kind);
      const withoutThreshold = [...'EXP-000123'].map(
        (char, index) => detector.accept(key(char), null, 20_000 + index * 5).kind,
      );

      expect(verdicts).toContain('burst');
      expect(withoutThreshold.every((kind) => kind === 'key')).toBe(true);
      expect(detector.accept(key('Enter'), null, 20_100)).toEqual({ kind: 'key' });
    });
  });

  it('reset forgets the open run', () => {
    type(detector, 'ABCD', 5);
    expect(detector.length).toBe(SCAN_MIN_KEYSTROKES);

    detector.reset();

    expect(detector.length).toBe(0);
    expect(detector.accept(key('Enter'), THRESHOLD, 10_100)).toEqual({ kind: 'key' });
  });
});
