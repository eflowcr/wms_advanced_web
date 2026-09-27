import { projectRunner } from './vitest.shared';

/**
 * shared. El nombre lleva `-lib` porque `vitest.shared.ts` ya es la base que comparten todos.
 * Piso = medido y truncado (2026-09-27, B15: 100 en las cuatro). Solo sube.
 */
export default projectRunner({
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
});
