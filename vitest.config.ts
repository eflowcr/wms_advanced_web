import { projectRunner } from './vitest.shared';

/**
 * El runner de los proyectos sin suite todavía: shared, api-client y testing. Umbrales en
 * cero es la decisión, no un número pendiente: un umbral sobre una suite vacía no mide
 * nada. El día que uno tenga pruebas reales recibe su `vitest.<proyecto>.config.ts` con
 * números medidos. Por qué hay uno por proyecto: vitest.shared.ts, antes de juntarlos.
 */
export default projectRunner({
  statements: 0,
  branches: 0,
  functions: 0,
  lines: 0,
});
