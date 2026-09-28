import { projectRunner } from './vitest.shared';

/**
 * showroom. Piso = medido y truncado (2026-09-27, B15: 99.09 / 94.66 / 98.23 / 99.05). Solo sube.
 * Sin design-system ni core: las demos los cubren de paso y se miden aparte. Ver vault: Integracion Continua §8.
 */
export default projectRunner(
  {
    statements: 99,
    branches: 94,
    functions: 98,
    lines: 99,
  },
  ['**/design-system/**', '**/core/**'],
);
