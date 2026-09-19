import { parseTableDate } from './table.tokens';

/**
 * The parse behind both implementations of `EWMS_TABLE_FORMATTERS`.
 *
 * THE WHOLE SUITE RUNS IN America/Costa_Rica (UTC-6), pinned in
 * vitest.shared.ts. That matters here more than anywhere else: the bug this
 * file exists to prevent is invisible in UTC, so a test written for it and run
 * at offset zero would pass against the broken code and prove nothing.
 *
 * Found on the DS-4 example screen, where a shipment dated 2026-03-15 was
 * drawn as 14/3/2026 -- and so was every other row, which is why nobody had
 * noticed: the dates are synthetic and being uniformly one day early looks
 * like data rather than like a defect.
 */
describe('parseTableDate', () => {
  it('reads a date-only value as that calendar day, in local time', () => {
    const parsed = parseTableDate('2026-03-15');

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    // Zero-based: 2 is March.
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(15);
  });

  it('puts it at local midnight, which is what pins it to the right day', () => {
    /*
     * The assertion that catches the bug in EVERY timezone rather than only in
     * this one. `new Date('2026-03-15')` lands on local midnight ONLY at offset
     * zero: at UTC-6 it is 18:00 the day before, at UTC+2 it is 02:00. So an
     * hour of zero is the property that says the value was never treated as an
     * instant.
     */
    expect(parseTableDate('2026-03-15')?.getHours()).toBe(0);
  });

  it('formats as the 15th, which is the defect seen from the screen', () => {
    // What the showroom's implementation of the token does with the result.
    // Before the fix this read 14/3/2026.
    const parsed = parseTableDate('2026-03-15');

    expect(new Intl.DateTimeFormat('es').format(parsed as Date)).toBe('15/3/2026');
  });

  it('agrees with a date built by hand for the same day', () => {
    const parsed = parseTableDate('2026-03-15');

    expect(parsed?.getTime()).toBe(new Date(2026, 2, 15).getTime());
  });

  it('does not move a value that carries a time and a zone', () => {
    /*
     * A timestamp IS an instant, and reinterpreting it as a local calendar day
     * would be the same mistake in the other direction. 08:00 UTC is 02:00 in
     * Costa Rica, on the same day.
     */
    const parsed = parseTableDate('2026-03-15T08:00:00Z');

    expect(parsed?.getDate()).toBe(15);
    expect(parsed?.getHours()).toBe(2);
  });

  it('returns null for nothing, and for something that is not a date', () => {
    for (const value of [null, undefined, '', 'sin fecha', 'EXP-2026-0400', {}]) {
      expect(parseTableDate(value), String(value)).toBeNull();
    }
  });

  it('returns null for a date-shaped value that is not a real day', () => {
    /*
     * `2026-02-30` has the shape and is not a date. The three-argument
     * constructor rolls it over to the 2nd of March without complaining, so a
     * typo in a row would be drawn as a real date a few days off. Rejecting it
     * makes the formatter print the raw text instead, which is information.
     */
    expect(parseTableDate('2026-02-30')).toBeNull();
    expect(parseTableDate('2026-13-01')).toBeNull();
    // And the leap year still works, because rejecting it would be the same
    // defect wearing the opposite sign.
    expect(parseTableDate('2028-02-29')?.getDate()).toBe(29);
  });
});
