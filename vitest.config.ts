import { projectRunner } from './vitest.shared';

/**
 * The runner for the projects that do not have a suite yet: shared,
 * api-client and testing.
 *
 * They have a test target in angular.json and nothing to run in it, so they
 * are not in `npm test`. THRESHOLDS AT ZERO IS THE DECISION, not a pending
 * number: a threshold over an empty suite measures nothing, and any figure
 * here would be the kind of theatre DS-0 refused.
 *
 * The day one of them gets real tests it gets its own
 * `vitest.<project>.config.ts` with its own MEASURED numbers, exactly like the
 * four that have one, and it stops pointing here.
 *
 * The four measured configs are vitest.shell.config.ts,
 * vitest.core.config.ts, vitest.design-system.config.ts and
 * vitest.showroom.config.ts. Why there is one per project rather than one file
 * with per-path thresholds is written down in vitest.shared.ts -- read it
 * before merging them back together.
 */
export default projectRunner({
  statements: 0,
  branches: 0,
  functions: 0,
  lines: 0,
});
