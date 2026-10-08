import { projectRunner } from './vitest.shared';

/** core. Piso = medido y truncado (2026-10-08: 98.00 / 94.44 / 100 / 98.25). Solo sube. */
export default projectRunner({
  statements: 98,
  branches: 94,
  functions: 100,
  lines: 98,
});
