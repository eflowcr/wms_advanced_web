import { projectRunner } from './vitest.shared';

/**
 * shell.
 *
 * Measured 2026-09-18 (DS-2): 79.24 / 66.19 / 81.13 / 78.11, truncated.
 *
 * The lowest of the four suites, and it is the only honest number for this
 * project: its run also covers `projects/core/**` in passing, at 74.73 %,
 * because it exercises what the shell uses rather than what core tests. That
 * is measured here and policed in core's own config.
 */
export default projectRunner({
  statements: 79,
  branches: 66,
  functions: 81,
  lines: 78,
});
