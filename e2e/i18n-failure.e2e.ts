import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * What the user sees when a dictionary does not load (i18n.md, "Cuando el
 * diccionario no carga"). The rule: they always find out, and never get a
 * silent screen.
 *
 * Aborting the request stands in for every real cause: a deploy that did not
 * copy public/, a 404, a network drop.
 */

const ES_DICTIONARY = '**/i18n/es.json';
const EN_DICTIONARY = '**/i18n/en.json';

/** CSP violations: anything inline in the host page would be dropped silently. */
function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  return violations;
}

test.describe('case B: the default dictionary does not load', () => {
  test.use({ locale: 'es-CR' });

  test('shows the static notice in both languages instead of a blank page', async ({ page }) => {
    const cspViolations = collectCspViolations(page);
    await page.route(ES_DICTIONARY, (route) => route.abort());

    await page.goto('/');

    const notice = page.locator('#startup-failure');
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('heading', { level: 1 })).toHaveText('eWMS Advance');
    await expect(notice.locator('p[lang="es"]')).toHaveText(
      'No se pudo cargar el idioma de la interfaz. Vuelva a intentarlo; si el problema continúa, avise a soporte.',
    );
    await expect(notice.locator('p[lang="en"]')).toHaveText(
      'The interface language could not be loaded. Please try again; if the problem continues, contact support.',
    );
    const retry = page.getByRole('button', { name: 'Reintentar / Try again' });
    await expect(retry).toBeVisible();

    // Not a blank page: Angular rendered nothing, and the notice is what fills it.
    await expect(page.locator('app-root')).toBeEmpty();
    expect((await page.locator('body').innerText()).trim()).not.toBe('');

    // Styled: startup-failure.css loaded, independently of the bundle, and the CSP let it.
    await expect(retry).toHaveCSS('background-color', 'rgb(68, 101, 236)');
    await expect(notice).toHaveCSS('color', 'rgb(1, 15, 66)');
    expect(cspViolations).toEqual([]);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('the retry button reloads, and the app starts once the dictionary is back', async ({
    page,
  }) => {
    await page.route(ES_DICTIONARY, (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('#startup-failure')).toBeVisible();

    await page.unroute(ES_DICTIONARY);
    await page.getByRole('button', { name: 'Reintentar / Try again' }).click();

    await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(page.locator('#startup-failure')).toBeHidden();
  });

  test('the notice stays hidden when the app starts normally', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(page.locator('#startup-failure')).toBeHidden();
  });
});

test.describe('case A: a dictionary other than the default does not load', () => {
  test.use({ locale: 'es-CR' });

  test.beforeEach(async ({ page }) => {
    await page.route(EN_DICTIONARY, (route) => route.abort());
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await page.getByLabel('Idioma', { exact: true }).selectOption('en');
  });

  test('stays in Spanish and working, tells the user, and saves nothing', async ({ page }) => {
    await expect(page.getByRole('alert')).toHaveText(
      'No se pudo cargar el idioma elegido. La interfaz sigue en español; vuelva a intentarlo más tarde.',
    );
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByLabel('Idioma', { exact: true })).toHaveValue('es');
    await expect(page.locator('[data-sample="plural"]').first()).toHaveText('Sin bultos');

    // Still working: navigation and rendering in Spanish carry on.
    await page.getByRole('link', { name: 'Sistema de diseño' }).click();
    await expect(page).toHaveURL(/\/design-system$/);
    await page.getByRole('link', { name: 'Inicio' }).click();
    await expect(page.getByText('Sin bultos')).toBeVisible();

    // The whole storage state of the context, serialized: the failed choice is not in it.
    expect(JSON.stringify(await page.context().storageState())).not.toContain('ewms.lang');
  });

  test('once the dictionary is back, the switch works and the notice goes away', async ({
    page,
  }) => {
    await expect(page.getByRole('alert')).toBeVisible();

    await page.unroute(EN_DICTIONARY);
    await page.getByLabel('Idioma', { exact: true }).selectOption('en');

    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(JSON.stringify(await page.context().storageState())).toContain('"ewms.lang"');
  });

  test('has no accessibility violations with the notice on screen', async ({ page }) => {
    await expect(page.getByRole('alert')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
