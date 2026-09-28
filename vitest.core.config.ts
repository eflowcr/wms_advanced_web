import { projectRunner } from './vitest.shared';

/** core. Piso = medido y truncado (2026-09-27, B15: 97.14 / 91.62 / 100 / 97.45). Solo sube. */
export default projectRunner({
  statements: 97,
  branches: 91,
  functions: 100,
  lines: 97,
});
