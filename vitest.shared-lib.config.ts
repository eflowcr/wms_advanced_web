import { projectRunner } from './vitest.shared';

/**
 * shared. El nombre lleva `-lib` porque `vitest.shared.ts` ya es la base que comparten todos.
 * Medido 2026-09-22, con `filtersInUrl` como primer contenido de la biblioteca.
 */
export default projectRunner({
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
});
