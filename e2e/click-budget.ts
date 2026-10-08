import type { Locator } from '@playwright/test';
/*
 * Único import profundo a projects/ del repo: el alias carga el barril de Angular en Node y falla con
 * «PlatformLocation needs to be compiled using the JIT compiler». Las E2E leen de acá las cifras.
 */
// eslint-disable-next-line no-restricted-imports -- ver la nota de arriba
export * from '../projects/shared/src/lib/click-budget';

/** Cuenta los clics de ratón de una prueba (REQ-FE-DS4-003 §2.1); el teclado no pasa por acá. */
export function clicker(): {
  click: (locator: Locator) => Promise<void>;
  dblclick: (locator: Locator) => Promise<void>;
  total: () => number;
} {
  let total = 0;
  return {
    click: async (locator) => {
      total += 1;
      await locator.click();
    },
    dblclick: async (locator) => {
      total += 2;
      await locator.dblclick();
    },
    total: () => total,
  };
}
