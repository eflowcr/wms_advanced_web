import { projectRunner } from './vitest.shared';

/**
 * design-system.
 *
 * Measured 2026-09-18 (DS-2): 95.94 / 91.62 / 94.84 / 96.86, truncated -- the
 * run that closed the four form primitives, 247 tests.
 *
 * These are the numbers DS-0 deferred to this phase, taken from what was
 * actually measured and not from a figure anyone hoped for.
 */
export default projectRunner({
  statements: 95,
  branches: 91,
  functions: 94,
  lines: 96,
});
