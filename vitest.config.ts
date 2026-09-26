import { projectRunner } from './vitest.shared';

/**
 * Runner de los proyectos sin suite todavía (api-client, testing). Umbrales en cero a propósito:
 * sobre una suite vacía no miden nada; con pruebas reales, su propio config con lo medido.
 * Ver vault: 02-Arquitectura/Integracion Continua.md §8.
 */
export default projectRunner({
  statements: 0,
  branches: 0,
  functions: 0,
  lines: 0,
});
