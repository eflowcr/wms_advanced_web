import { axe } from './axe';
import { expect, test } from '@playwright/test';

/**
 * Sin configuración de ejecución válida la app no arranca, y lo dice con el aviso estático de
 * index.html, igual que sin diccionario (ADR 0017). Nunca una pantalla muda.
 */

const CONFIG = '**/config.json';

test.describe('the runtime configuration is invalid or missing', () => {
  test.use({ locale: 'es-CR' });

  test('an unknown field stops the start and the notice says it is the configuration', async ({
    page,
  }) => {
    await page.route(CONFIG, (route) => route.fulfill({ json: { environment: 'prod' } }));

    await page.goto('/');

    const notice = page.locator('#startup-failure');
    await expect(notice).toBeVisible();
    await expect(notice.locator('p[data-cause="config"][lang="es"]')).toHaveText(
      'No se pudo cargar la configuración de la aplicación. Vuelva a intentarlo; si el problema continúa, avise a soporte.',
    );
    await expect(notice.locator('p[data-cause="config"][lang="en"]')).toHaveText(
      'The application configuration could not be loaded. Please try again; if the problem continues, contact support.',
    );
    await expect(notice.locator('p[data-cause="dictionary"]')).toHaveCount(2);
    for (const message of await notice.locator('p[data-cause="dictionary"]').all()) {
      await expect(message).toBeHidden();
    }
    await expect(page.locator('app-root')).toBeEmpty();

    const results = await axe(page).analyze();
    expect(results.violations).toEqual([]);
  });

  test('a configuration that does not load stops the start the same way', async ({ page }) => {
    await page.route(CONFIG, (route) => route.abort());

    await page.goto('/');

    await expect(page.locator('p[data-cause="config"][lang="es"]')).toBeVisible();
  });
});
