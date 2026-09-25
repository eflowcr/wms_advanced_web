import { projectRunner } from './vitest.shared';

/**
 * shell. Medido 2026-09-25: 96.17 / 92.59 / 91.66 / 96.58, truncado; sin core ni design-system, que
 * la corrida cubría de paso y se miden en la suya. Ver vault: Integracion Continua.md §8.
 */
export default projectRunner(
  {
    statements: 96,
    branches: 92,
    functions: 91,
    lines: 96,
  },
  ['**/design-system/**', '**/core/**'],
);
