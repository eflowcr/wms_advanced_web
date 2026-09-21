import { expect, test } from '@playwright/test';

/**
 * Los tokens de icono solo existen en la hoja real: el par ancho / grosor de trazo por tamaño
 * (tokens.css, ADR 0011) se afirma acá, en navegador, y no en jsdom.
 */
const EXPECTED = {
  sm: { width: 16, strokeWidth: 2.25 },
  md: { width: 18, strokeWidth: 2 },
  lg: { width: 20, strokeWidth: 2 },
  xl: { width: 24, strokeWidth: 1.75 },
} as const;

test.describe('/design-system/foundations/icons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/design-system/foundations/icons');
    await expect(page.getByRole('heading', { level: 1, name: 'Iconografía' })).toBeVisible();
  });

  test('each size applies its width and compensated stroke width', async ({ page }) => {
    for (const [size, expected] of Object.entries(EXPECTED)) {
      const svg = page.locator(`[data-icon-size="${size}"] svg`);
      const box = await svg.boundingBox();
      expect(box?.width, size).toBe(expected.width);
      expect(box?.height, size).toBe(expected.width);
      // Chromium serializa el stroke-width calculado en unidades de usuario, como "2.25px".
      const strokeWidth = await svg.evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth));
      expect(strokeWidth, size).toBe(expected.strokeWidth);
    }
  });

  test('icons inherit the colour of their container', async ({ page }) => {
    const colours = await page
      .locator('[aria-labelledby="iconography-grounds"] ul')
      .evaluateAll((lists) =>
        lists.map((list) => {
          const svg = list.querySelector('svg');
          return svg ? [getComputedStyle(list).color, getComputedStyle(svg).stroke] : [];
        }),
      );
    expect(colours).toHaveLength(2);
    for (const [container, stroke] of colours) {
      expect(stroke).toBe(container);
    }
    expect(colours[0]?.[0]).not.toBe(colours[1]?.[0]);
  });

  // Sin axe acá: esta ruta ya se escanea en showroom.e2e.ts con las otras veintitrés.
});
