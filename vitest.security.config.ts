import { projectRunner } from './vitest.shared';

// Piso medido del dominio; las bibliotecas externas conservan sus propias suites.
export default projectRunner({ statements: 74, branches: 71, functions: 79, lines: 80 }, [
  '**/projects/core/**',
  '**/projects/design-system/**',
  '**/projects/shared/**',
  '**/projects/api-client/**',
  '**/*.fixtures.ts',
  '**/security-messages.ts',
]);
