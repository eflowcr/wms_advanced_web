import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Renderiza cada ruta del showroom, la captura y anota lo que midió.
 * Por qué es un banco de captura y no una prueba: ver playwright.capture.config.ts.
 */

const OUT = path.resolve('showroom-captures');

const ROUTES = [
  { name: '01-home', url: '/design-system' },
  { name: '02-foundations-brand', url: '/design-system/foundations/brand' },
  { name: '03-foundations-colors', url: '/design-system/foundations/colors' },
  { name: '04-foundations-typography', url: '/design-system/foundations/typography' },
  { name: '05-foundations-spacing', url: '/design-system/foundations/spacing' },
  { name: '06-foundations-icons', url: '/design-system/foundations/icons' },
  { name: '07-components-button', url: '/design-system/components/button' },
  { name: '08-components-text', url: '/design-system/components/text' },
  { name: '10-components-tooltip', url: '/design-system/components/tooltip' },
  { name: '11-components-input', url: '/design-system/components/input' },
  { name: '12-components-select', url: '/design-system/components/select' },
  { name: '13-components-checkbox', url: '/design-system/components/checkbox' },
  { name: '14-components-radio', url: '/design-system/components/radio' },
  { name: '15-components-toggle', url: '/design-system/components/toggle' },
  { name: '16-components-banner', url: '/design-system/components/banner' },
  { name: '17-components-toast', url: '/design-system/components/toast' },
  { name: '18-components-card', url: '/design-system/components/card' },
  { name: '19-components-dialog', url: '/design-system/components/dialog' },
  { name: '21-components-table', url: '/design-system/components/table' },
  { name: '22-components-pagination', url: '/design-system/components/pagination' },
  { name: '23-components-split-button', url: '/design-system/components/split-button' },
  { name: '24-components-date-picker', url: '/design-system/components/date-picker' },
] as const;

/**
 * Con la fuente de respaldo en pantalla todo ancho medido está mal. document.fonts.ready solo no
 * alcanza: resuelve sin bajar pesos aún no pintados, y estas páginas pintan de 400 a 700.
 */
async function waitForMontserrat(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      [400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 1rem Montserrat`)),
    );
    await document.fonts.ready;
  });
  const ready = await page.evaluate(() => document.fonts.check('700 1rem Montserrat'));
  expect(ready, 'Montserrat must be loaded before anything is captured or measured').toBe(true);
}

interface Measured {
  readonly name: string;
  readonly box: string;
  readonly styles: Readonly<Record<string, string>>;
}

/**
 * Geometría y propiedades calculadas de todo lo marcado con data-measure: leerlas del navegador
 * es la única forma de saber que un token se aplicó.
 */
async function measure(page: Page): Promise<readonly Measured[]> {
  return page.evaluate(() => {
    const PROPERTIES = [
      'font-family',
      'font-size',
      'font-weight',
      'line-height',
      'color',
      'background-color',
      'border-color',
      'border-width',
      'border-radius',
      'box-shadow',
      'padding',
      'gap',
      'outline-color',
    ];
    return [...document.querySelectorAll('[data-measure]')].map((element) => {
      const rect = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      const styles: Record<string, string> = {};
      for (const property of PROPERTIES) {
        const value = computed.getPropertyValue(property).trim();
        if (value && value !== 'none' && value !== 'normal' && value !== '0px') {
          styles[property] = value;
        }
      }
      return {
        name: element.getAttribute('data-measure') ?? '(unnamed)',
        box: `${rect.width.toFixed(2)} x ${rect.height.toFixed(2)}`,
        styles,
      };
    });
  });
}

/** El desplazamiento horizontal es un defecto: se reporta por ancho. */
async function overflow(page: Page, width: number): Promise<string> {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  return result.scroll > result.client
    ? `OVERFLOW at ${width}: scrollWidth ${result.scroll} > clientWidth ${result.client}`
    : `ok at ${width}`;
}

/**
 * Tabula hasta enfocar el elemento: con .focus() el navegador no concede focus-visible,
 * que solo da el anillo cuando el foco llega por teclado.
 */
async function focusByTabbing(page: Page, selector: string, maxTabs = 80): Promise<boolean> {
  // Blur y no clic: un clic para «reiniciar» el foco caía en el primer enlace de la cabecera y la app
  // navegaba a otra página. Blur borra el punto de partida de Tab sin tocar nada.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(
      (target) => Boolean(document.activeElement?.closest(target)),
      selector,
    );
    if (hit) {
      return true;
    }
  }
  return false;
}

function render(title: string, rows: readonly Measured[]): string {
  const lines = [`\n===== ${title} =====`];
  if (rows.length === 0) {
    lines.push('  (nothing tagged with data-measure)');
  }
  for (const row of rows) {
    lines.push(`  ${row.name}`);
    lines.push(`    box: ${row.box}`);
    for (const [property, value] of Object.entries(row.styles)) {
      lines.push(`    ${property}: ${value}`);
    }
  }
  return lines.join('\n');
}

const report: string[] = [];

test.describe('showroom capture rig', () => {
  test.beforeAll(async () => {
    await mkdir(OUT, { recursive: true });
  });

  test.afterAll(async () => {
    await writeFile(path.join(OUT, 'measurements.txt'), `${report.join('\n')}\n`, 'utf8');
  });

  for (const route of ROUTES) {
    test(`captures ${route.name}`, async ({ page }) => {
      await page.goto(route.url);
      await waitForMontserrat(page);
      await page.waitForTimeout(250);

      await page.screenshot({ path: path.join(OUT, `${route.name}.png`), fullPage: true });

      report.push(render(`${route.name} (${route.url})`, await measure(page)));
      report.push(`  ${await overflow(page, 1440)}`);
      report.push(`  ${await overflow(page, 1280)}`);
      await page.setViewportSize({ width: 1440, height: 900 });
    });
  }

  test('captures the states nothing shows on its own', async ({ page }) => {
    await page.goto('/design-system/components/button');
    await waitForMontserrat(page);

    // Foco por teclado sobre los dos fondos: el hueco de 2px de --focus-ring-shadow se pinta con
    // --color-surface, así que sobre el lienzo es donde puede fallar.
    const focusedOnCanvas = await focusByTabbing(page, '[data-focus-canvas]');
    expect(focusedOnCanvas, 'the canvas focus sample must be reachable by Tab').toBe(true);
    await page.screenshot({ path: path.join(OUT, '20-focus-on-canvas.png') });

    const focusedOnSurface = await focusByTabbing(page, '[data-focus-surface]');
    expect(focusedOnSurface, 'the surface focus sample must be reachable by Tab').toBe(true);
    await page.screenshot({ path: path.join(OUT, '21-focus-on-surface.png') });

    // Loading vuelve solo a Default: la captura se toma mientras gira.
    await page.locator('[data-demo-submit] button').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '22-button-loading.png') });
    report.push(render('button page, loading', await measure(page)));

    const tooltipFocused = await focusByTabbing(page, '[data-demo-tooltip]');
    expect(tooltipFocused, 'the tooltip sample must be reachable by Tab').toBe(true);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '23-tooltip-open.png') });

    // El panel del Select: el CSS de overlay del CDK llegó en el PR 2 y acá corre por primera vez en navegador.
    await page.goto('/design-system/foundations/spacing');
    await waitForMontserrat(page);
    await page.locator('[data-demo-select] [role="combobox"]').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '24-select-open.png') });
    report.push(render('spacing page, select open', await measure(page)));

    // La ficha del Select con el panel abierto: el bucle de ROUTES no puede tomarla porque en una
    // página recién cargada no hay nada abierto.
    await page.goto('/design-system/components/select');
    await waitForMontserrat(page);
    await page.locator('[data-demo-select] [role="combobox"]').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '25-select-page-open.png') });

    // El panel del Select cerca del borde inferior, donde tiene que abrirse hacia arriba.
    await page.locator('[data-demo-select]').evaluate((el) => {
      const style = (el as HTMLElement).style;
      style.position = 'fixed';
      style.zIndex = '1';
      style.left = '40px';
      style.top = 'calc(100vh - 90px)';
      style.width = '320px';
    });
    await page.locator('[data-demo-select] [role="combobox"]').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '26-select-flipped.png') });

    // La ficha del tooltip abierta por teclado: es un overlay y no sale en las capturas de página completa.
    await page.goto('/design-system/components/tooltip');
    await waitForMontserrat(page);
    const sheetTooltip = await focusByTabbing(page, '[data-demo-describes]');
    expect(sheetTooltip, 'the descriptive tooltip host must be reachable by Tab').toBe(true);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '27-tooltip-page-open.png') });

    // Las cuatro posiciones de a una: solo existe un tooltip a la vez.
    for (const position of ['top', 'bottom', 'left', 'right'] as const) {
      await page.locator(`[data-position-sample="${position}"] button`).hover();
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(OUT, `28-tooltip-${position}.png`) });
    }

    // La clave del Input revelada: requiere un clic en el botón sufijo, ninguna captura completa llega.
    await page.goto('/design-system/components/input');
    await waitForMontserrat(page);
    await page.getByRole('button', { name: 'Mostrar la clave' }).first().click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '29-input-password-shown.png') });
    report.push(render('input page, password revealed', await measure(page)));
  });

  // Estados del lote D que una página recién cargada no muestra: panel desplegado, menú abierto,
  // hijos pedidos y cinco mil filas construidas.
  test('captures the DS-3 lote D states', async ({ page }) => {
    const TABLE_PAGE = '/design-system/components/table';
    const DETALLE = '[data-demo-detalle]';
    const PEREZOSA = '[data-demo-perezosa]';
    const VIRTUAL = '[data-demo-virtual]';
    const PAGINADA = '[data-demo-paginada]';

    await page.goto(TABLE_PAGE);
    await waitForMontserrat(page);
    await page.waitForTimeout(250);

    await page.locator(`${DETALLE} [data-detail-toggle="0"] button`).click();
    await page.locator(`${DETALLE} [data-detail="0"]`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '30-table-detail-open.png') });
    report.push(render('table page, detail panel open', await measure(page)));

    // El menú de fila (kebab) es un overlay: ninguna captura de página completa lo contiene.
    await page.locator(`${DETALLE} [data-kebab="1"] button`).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, '31-table-row-menu.png') });
    await page.keyboard.press('Escape');

    // Hijos en camino e hijos que nunca llegan: la fila de carga dura lo que la demora de la demo.
    const failing = page.locator(`${PEREZOSA} tr.bg-danger-surface`).first();
    const failingRow = await failing.getAttribute('data-row');
    const ok = page.locator(`${PEREZOSA} tr[data-row]:not(.bg-danger-surface)`).first();
    const okRow = await ok.getAttribute('data-row');

    // Dos filas distintas: plegar la que falla para reusarla se llevaría su fila de error,
    // que es el comportamiento correcto.
    await page.locator(`${PEREZOSA} [data-toggle="${okRow}"]`).click();
    await page.locator(`${PEREZOSA} [data-loading="${okRow}"]`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, '32-table-children-loading.png') });

    await page.locator(`${PEREZOSA} [data-toggle="${failingRow}"]`).click();
    await expect(page.locator(`${PEREZOSA} [data-failed="${failingRow}"]`)).toBeVisible();
    await page.locator(`${PEREZOSA} [data-failed="${failingRow}"]`).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, '33-table-children-failed.png') });

    await page.locator('[data-load-all]').click();
    await expect(page.locator('[data-loaded-count]')).toContainText('5000');
    await page.locator(VIRTUAL).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '34-table-virtual-top.png') });
    report.push(render('table page, five thousand rows windowed', await measure(page)));

    // Mil filas más abajo: la ventana se movió y la cabecera sigue fija arriba.
    await page.locator(`${VIRTUAL} [data-scroll-box]`).evaluate((element) => {
      element.scrollTop = 32 * 1000;
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, '35-table-virtual-scrolled.png') });

    await page.locator(PAGINADA).scrollIntoViewIfNeeded();
    await page.locator(`${PAGINADA} [data-next-page] button`).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '36-table-paginator.png') });
    report.push(render('table page, paginator on page two', await measure(page)));
  });
});
