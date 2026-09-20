import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * ADR 0008 in a real browser: the switch happens without reloading, <html lang>
 * follows it, the choice survives a reload, and the page is clean for axe in
 * both languages.
 */

async function switchTo(page: Page, from: string, value: 'es' | 'en'): Promise<void> {
  await page.getByLabel(from, { exact: true }).selectOption(value);
}

test.describe('i18n with a Spanish browser', () => {
  test.use({ locale: 'es-CR' });

  // A CSP violation (e.g. an eval-based ICU compiler) or a missing key thrown
  // by the development missing handler surfaces here as a console error.
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));
    await page.goto('/');
    await expect(page.getByRole('treeitem', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Menú principal' })).toBeVisible();
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
  });

  test('switching language changes the text on screen without reloading', async ({ page }) => {
    let navigations = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        navigations += 1;
      }
    });
    await page.evaluate(() => {
      (window as unknown as { beforeSwitch: boolean }).beforeSwitch = true;
    });

    await switchTo(page, 'Idioma', 'en');

    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'Design system' })).toBeVisible();
    await expect(page.getByText('No packages')).toBeVisible();
    await expect(page.getByText('1,250 packages')).toBeVisible();
    // Same document: the flag set before switching is still there.
    expect(
      await page.evaluate(() => (window as unknown as { beforeSwitch?: boolean }).beforeSwitch),
    ).toBe(true);
    expect(navigations).toBe(0);
  });

  test('<html lang> follows the language', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');

    await switchTo(page, 'Idioma', 'en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('the choice survives a reload', async ({ page }) => {
    await switchTo(page, 'Idioma', 'en');
    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
    // Also proves storageState exposes the key, so the "not saved" test below is not vacuous.
    expect(JSON.stringify(await page.context().storageState())).toContain('"ewms.lang"');

    await page.reload();

    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en');
  });

  test('formats numbers, dates and plurals with the locale of each language', async ({ page }) => {
    const sample = (name: string) => page.locator(`[data-sample="${name}"]`);
    // es-CR groups thousands with a no-break space. Whether a 4-digit number
    // is grouped depends on the ICU data of the runtime, hence the \s?.
    await expect(sample('number')).toHaveText(/Peso neto: 12\s345,678 kg/);
    await expect(sample('plural').nth(2)).toHaveText(/1\s?250 bultos/);
    await expect(sample('currency')).toHaveText(/Monto: ₡\s?1\s250\s000,00/);
    await expect(sample('date')).toHaveText(/Hoy es \d{1,2} de [a-z]+ de \d{4}/);

    await switchTo(page, 'Idioma', 'en');

    await expect(sample('number')).toHaveText('Net weight: 12,345.678 kg');
    // The currency stays CRC: it is data, not a language preference.
    await expect(sample('currency')).toHaveText('Amount: CRC 1,250,000.00');
    await expect(sample('date')).toHaveText(/Today is [A-Z][a-z]+ \d{1,2}, \d{4}/);
  });

  for (const language of ['es', 'en'] as const) {
    test(`has no accessibility violations in ${language}`, async ({ page }) => {
      if (language === 'en') {
        await switchTo(page, 'Idioma', 'en');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      }
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe('i18n with an English browser', () => {
  test.use({ locale: 'en-GB' });

  test('starts in English from the browser language prefix, without saving it', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // The whole storage state of the context, serialized: the key must not be in it.
    expect(JSON.stringify(await page.context().storageState())).not.toContain('ewms.lang');
  });
});
