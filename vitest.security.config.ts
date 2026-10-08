import { projectRunner } from './vitest.shared';

// Piso medido y truncado del dominio (2026-10-08: 76.54 / 76.76 / 82.92 / 81.28); solo sube.
// Las bibliotecas externas conservan sus propias suites.
export default projectRunner({ statements: 76, branches: 76, functions: 82, lines: 81 }, [
  '**/projects/core/**',
  '**/projects/design-system/**',
  '**/projects/shared/**',
  '**/projects/api-client/**',
  '**/*.fixtures.ts',
  '**/security-messages.ts',
]);
