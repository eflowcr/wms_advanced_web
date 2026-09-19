import { projectRunner } from './vitest.shared';

/**
 * core.
 *
 * Measured 2026-09-18 (DS-2): 95.10 / 86.28 / 97.56 / 96.00, truncated.
 */
export default projectRunner({
  statements: 95,
  branches: 86,
  functions: 97,
  lines: 96,
});
