import { projectRunner } from './vitest.shared';

// Piso medido y truncado del dominio (2026-10-08: 97.49 / 92.04 / 97.25 / 98.75); solo sube.
// Las bibliotecas externas conservan sus propias suites.
export default projectRunner({ statements: 97, branches: 92, functions: 97, lines: 98 }, [
  '**/projects/core/**',
  '**/projects/design-system/**',
  '**/projects/shared/**',
  '**/projects/api-client/**',
  '**/*.fixtures.ts',
  '**/security-messages.ts',
]);
