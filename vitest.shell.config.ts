import { projectRunner } from './vitest.shared';

/**
 * shell. Medido 2026-09-19 (DS-5): 82.13 / 69.67 / 85.29 / 80.85, truncado (era
 * 79 / 66 / 81 / 78 en DS-2; subió con TabsService, la estrategia de título y el asiento
 * de sesión). La corrida también cubre `projects/core/**` de paso; eso se vigila en core.
 * `MainLayout` no está en este número: lo que vale defender de él (skip link, foco en el
 * `h1`, pestañas que siguen al router) pide un navegador real y lo afirma e2e/smoke.e2e.ts.
 */
export default projectRunner({
  statements: 82,
  branches: 69,
  functions: 85,
  lines: 80,
});
