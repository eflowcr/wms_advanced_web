import { expect, type Page } from '@playwright/test';

/**
 * Lo que una página no puede ensuciar: la consola de errores y la CSP estricta de index.html
 * (PLN-WMS-003 §4), que descarta lo que bloquea sin fallar nada. No es un spec: testMatch solo
 * toma los .e2e.ts. Ver vault: 02-Arquitectura/Integracion Continua.
 */

/** Lo que devuelve `watchConsole`. */
export interface ConsoleWatch {
  /** Falla con la lista de lo aparecido desde la llamada anterior, y la vacía. */
  clean(where: string): Promise<void>;
}

interface WindowWithViolations extends Window {
  __cspViolations?: string[];
}

/**
 * Se engancha antes del primer `goto`: una violación de CSP llega mientras la página carga.
 * `securitypolicyviolation` es un evento del DOM y no viaja por el protocolo, así que se
 * recoge dentro de la página y se lee en cada `clean()`.
 */
export async function watchConsole(page: Page): Promise<ConsoleWatch> {
  const problems: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(`console.error — ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    problems.push(`pageerror — ${error.message}`);
  });

  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as WindowWithViolations).__cspViolations = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`CSP — ${event.violatedDirective}: ${event.blockedURI || 'en línea'}`);
    });
  });

  return {
    clean: async (where) => {
      const violations = await page.evaluate(
        () => (window as WindowWithViolations).__cspViolations ?? [],
      );
      const found = [...problems, ...violations];
      problems.length = 0;
      expect(found, `${where}: ensució la consola o violó la CSP`).toEqual([]);
    },
  };
}
