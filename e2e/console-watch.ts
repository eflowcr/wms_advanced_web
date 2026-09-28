import { expect, type Page } from '@playwright/test';

/**
 * Lo que una página no puede ensuciar: la consola, la CSP estricta de index.html (PLN-WMS-003 §4)
 * y el texto, donde una clave que falta se ve como su ruta en producción. No es un spec.
 * Ver vault: 02-Arquitectura/Integracion Continua.
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
      // En desarrollo la clave faltante lanza; en producción queda escrita: se busca en pantalla.
      const untranslated = await page.evaluate(() => {
        // Fuera de <pre> y <code>: el catálogo muestra claves como ejemplo de código.
        const prose = (element: Element | null): boolean =>
          element !== null && element.closest('pre, code') === null;
        const texts: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const parent = node.parentElement;
          if (prose(parent) && parent?.checkVisibility()) texts.push(node.textContent ?? '');
        }
        const names = ['aria-label', 'title', 'placeholder', 'alt'];
        const attributes = [...document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')]
          .filter(prose)
          .flatMap((element) => names.map((name) => element.getAttribute(name) ?? ''));
        const text = [...texts, ...attributes].join('\n');
        const keys = text.match(/\b(?:shell|showroom|ds|common)\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+\b/g);
        return [...new Set(keys ?? [])].map((key) => `i18n — clave sin traducir: ${key}`);
      });
      const found = [...problems, ...violations, ...untranslated];
      problems.length = 0;
      expect(found, `${where}: ensució la consola, la CSP o el texto`).toEqual([]);
    },
  };
}
