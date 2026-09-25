import { projectRunner } from './vitest.shared';

/**
 * shell. Medido 2026-09-25: 99.33 / 97.36 / 98.73 / 99.61, truncado; sin core, design-system ni
 * showroom, que la corrida cubría de paso y se miden en la suya. Ver vault: Integracion Continua.md §8.
 */
export default projectRunner(
  {
    statements: 99,
    branches: 97,
    functions: 98,
    lines: 99,
  },
  ['**/design-system/**', '**/core/**', '**/showroom/**'],
);
