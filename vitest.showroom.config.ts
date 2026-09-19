import { projectRunner } from './vitest.shared';

/**
 * showroom.
 *
 * Measured 2026-09-18 (DS-2 PR 4): 99.22 / 94.06 / 98.44 / 98.83, truncated.
 * Every one of the four is higher than the number it replaces (PR 3 measured
 * 97.78 / 91.96 / 96.84 / 97.13).
 *
 * The eight new component sheets pushed it up rather than down for one
 * reason: each of them reads its measured claims through
 * pages/components/measure.ts, so the "there was nothing to measure" arm --
 * which by construction never runs on a page that rendered -- is a single
 * function with an ordinary argument instead of six unreachable branches
 * scattered across six pages.
 *
 * THE DESIGN SYSTEM IS EXCLUDED FROM THIS RUN AS OF THIS PR, AND WHY.
 *
 * The previous numbers (96.22 / 86.66 / 88.23 / 95.28) were measured when the
 * only design-system code a showroom page imported was `ewms-icon`. The
 * catalogue pages now render nine real components -- that is the entire point
 * of them -- which dragged roughly two thousand statements of design-system
 * code into this run, covered only as far as a demo happens to exercise them.
 * The number stopped being about the showroom.
 *
 * Those files did not lose a gate: `ng test design-system` measures them
 * against the design system's own thresholds, which is where that number
 * means something. What this run now measures is the showroom, and the bar it
 * has to clear went UP rather than down.
 */
export default projectRunner(
  {
    statements: 99,
    branches: 93,
    functions: 98,
    lines: 98,
  },
  ['**/design-system/**'],
);
