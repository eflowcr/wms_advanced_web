import { projectRunner } from './vitest.shared';

/**
 * shell. Piso = medido y truncado (2026-09-27, B15: 99.41 / 97.70 / 98.83 / 99.66). Solo sube.
 * Sin core, design-system ni showroom: cada uno se mide en su corrida. Ver vault: IC §8.
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
