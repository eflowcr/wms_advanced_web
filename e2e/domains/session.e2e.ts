import { expect, test } from '@playwright/test';
import { axe } from '../axe';
import { watchConsole } from '../console-watch';
import { DEMO_PASSWORD, openSignedIn, signIn } from '../session';

/** REQ-FE-SEC-002, RFE-01: sesión contra el simulador del contrato, en el artefacto de demostración. */

test('a protected address asks to sign in and returns to it afterwards', async ({ page }) => {
  const watch = await watchConsole(page);
  await page.goto('/configuracion/usuarios?state=inactive');
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  await expect(page.locator('[data-app-header]')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Iniciar sesión');

  await signIn(page);
  await expect(page).toHaveURL(/\/configuracion\/usuarios\?state=inactive$/);
  await expect(page.locator('[data-users-page]')).toBeVisible();
  await watch.clean('sign-in and return');
});

test('wrong credentials stay on sign-in, say so and keep no password', async ({ page }) => {
  await page.goto('/login');
  const form = page.locator('[data-login-form]');
  await form.locator('input[autocomplete="username"]').fill('nadie');
  await form.locator('input[autocomplete="current-password"]').fill(DEMO_PASSWORD);
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('[data-login-error]')).toContainText('Usuario o contraseña incorrectos.');
  await expect(page).toHaveURL(/\/login$/);
  await expect(form.locator('input[autocomplete="current-password"]')).toHaveValue('');
});

test('signing out closes the console and its protected addresses', async ({ page }) => {
  await openSignedIn(page, '/configuracion/perfiles');
  await expect(page.locator('[data-permission-matrix]')).toBeVisible();
  await page.locator('[data-shell-logout]').click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('[data-security-page]')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('[data-security-page]')).toHaveCount(0);
});

// PACQ-08: con la sesión iniciada, nada de ella queda en el almacenamiento del navegador.
// Se lee desde fuera, como una revisión: storageState y el protocolo de DevTools, cookies HttpOnly incluidas.
test('a signed-in session leaves no token or credential in browser storage', async ({ page }) => {
  await openSignedIn(page, '/configuracion/usuarios');
  await expect(page.locator('[data-users-page] ewms-table')).toBeVisible();
  const state = await page.context().storageState();
  const origin = new URL(page.url()).origin;
  const devtools = await page.context().newCDPSession(page);
  await devtools.send('DOMStorage.enable');
  const { entries: perTab } = await devtools.send('DOMStorage.getDOMStorageItems', {
    storageId: { securityOrigin: origin, isLocalStorage: false },
  });
  const { databaseNames } = await devtools.send('IndexedDB.requestDatabaseNames', {
    securityOrigin: origin,
  });

  const kept = state.origins.flatMap(({ localStorage: items }) => items);
  for (const { name } of kept) expect(name).toMatch(/^ewms\.(lang|tableViews\.)/);
  expect(perTab).toEqual([]);
  expect(databaseNames).toEqual([]);
  const everything = JSON.stringify({ state, perTab });
  expect(everything).not.toContain(DEMO_PASSWORD);
  expect(everything).not.toMatch(/simulated-\d|bearer|token/i);
});

for (const locale of ['es-CR', 'en-US']) {
  test(`sign-in is accessible at desktop and mobile (${locale})`, async ({ browser }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/login');
      await expect(page.locator('[data-login-form]')).toBeVisible();
      // axe mide lo asentado: la entrada escalonada termina antes de medir contraste.
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
            .map((animation) => animation.finished),
        ),
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const result = await axe(page).analyze();
      expect(result.violations, `${width} px`).toEqual([]);
    }
    await page.locator('input[autocomplete="username"]').focus();
    await page.keyboard.type('admin');
    await page.keyboard.press('Tab');
    await page.keyboard.type(DEMO_PASSWORD);
    await page.keyboard.press('Enter');
    await expect(page).not.toHaveURL(/\/login/);
    await context.close();
  });
}

// Con movimiento normal la pantalla se anima; con `reduce`, nada se mueve (la espera, en login.spec).
test('with reduced motion nothing on sign-in moves', async ({ browser }) => {
  const moving = await browser.newPage();
  await moving.goto('/login');
  await expect(moving.locator('[data-login-form]')).toBeVisible();
  expect(await moving.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
  await moving.close();

  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.locator('[data-login-form]')).toBeVisible();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await signIn(page);
  await context.close();
});
