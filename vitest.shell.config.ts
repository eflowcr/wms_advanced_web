import { projectRunner } from './vitest.shared';

/**
 * shell. Piso = medido y truncado (2026-09-28: 99.40 / 98.34 / 98.82 / 99.66). Solo sube.
 * Sin core, design-system ni showroom: cada uno se mide en su corrida. Ver vault: Integracion Continua §8.
 */
export default projectRunner(
  {
    statements: 99,
    branches: 98,
    functions: 98,
    lines: 99,
  },
  ['**/design-system/**', '**/core/**', '**/showroom/**'],
);
