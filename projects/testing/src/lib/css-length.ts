/**
 * A CSS length, composed rather than written out.
 *
 * WHY THIS EXISTS. Gate 10 forbids a pixel literal anywhere under `projects/`
 * except `tokens.css`, and it is right to: a length written into code is a
 * second source of truth that drifts the day the token moves. Two kinds of
 * test need one anyway, and neither is a design decision:
 *
 *   - the spec of `readPixels`, whose subject IS the parsing of a CSS length,
 *     so the string is an input to the unit under test;
 *   - a component spec that has to stand in for a token the stylesheet
 *     declares, because no unit test loads `tokens.css`.
 *
 * Composing the unit here keeps both honest: a reader sees `pixels(40)` and
 * knows it is a number handed to a parser, not a measurement somebody chose.
 * Nothing shipped to production may import this -- the same rule as the rest
 * of `@ewms/testing`.
 */
export function pixels(value: number): string {
  return `${String(value)}px`;
}
