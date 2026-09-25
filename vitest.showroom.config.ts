import { projectRunner } from './vitest.shared';

/**
 * showroom. Medido 2026-09-18 (DS-2 PR 4): 99.22 / 94.06 / 98.44 / 98.83, truncado (PR 3:
 * 97.78 / 91.96 / 96.84 / 97.13). Las fichas leen sus medidas por pages/components/measure.ts,
 * así que la rama «no había nada que medir» es una función y no seis ramas inalcanzables.
 *
 * El design-system se excluye de esta corrida: las páginas renderizan nueve componentes
 * reales y traían unas dos mil sentencias cubiertas solo por las demos. Esos archivos los
 * mide `ng test design-system` con sus propios umbrales.
 *
 * Re-medido 2026-09-19 (DS-4): 99.42 / 93.25 / 98.52 / 99.24. Branches bajó de 94.06 a
 * 93.25 porque las páginas de patrones son las primeras que hacen cosas (cada decisión es
 * una rama). El umbral no se sube al último medido: eso dejaría de ser una decisión.
 */
export default projectRunner(
  {
    statements: 99,
    branches: 93,
    functions: 98,
    lines: 98,
  },
  ['**/design-system/**', '**/core/**'],
);
