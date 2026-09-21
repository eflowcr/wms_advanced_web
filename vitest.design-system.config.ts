import { projectRunner } from './vitest.shared';

/**
 * design-system. Medido 2026-09-18 (DS-2): 95.94 / 91.62 / 94.84 / 96.86, truncado; la
 * corrida que cerró las cuatro primitivas de formulario, 247 pruebas.
 */
export default projectRunner({
  statements: 95,
  branches: 91,
  functions: 94,
  lines: 96,
});
