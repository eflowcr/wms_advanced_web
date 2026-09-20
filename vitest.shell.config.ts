import { projectRunner } from './vitest.shared';

/**
 * shell.
 *
 * Measured 2026-09-19 (DS-5): 82.13 / 69.67 / 85.29 / 80.85, truncated. It was
 * 79 / 66 / 81 / 78 in DS-2; the App Shell arrived with `TabsService`, the
 * title strategy and the session seat, all three of which are arithmetic and
 * are tested as such, so the number went UP rather than down.
 *
 * Still the lowest of the four suites, and still the only honest number for
 * this project: its run also covers `projects/core/**` in passing, because it
 * exercises what the shell uses rather than what core tests. That is measured
 * here and policed in core's own config.
 *
 * WHAT IS NOT IN THIS NUMBER: `MainLayout` itself. No spec renders it -- what
 * it does that is worth defending (the skip link, the focus landing on the
 * `h1`, the tab strip following the router) is behaviour of a real browser
 * with a real router, and it is asserted in `e2e/smoke.e2e.ts`. A jsdom render
 * of it would raise this percentage and check none of that.
 */
export default projectRunner({
  statements: 82,
  branches: 69,
  functions: 85,
  lines: 80,
});
