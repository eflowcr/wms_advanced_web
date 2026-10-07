import { expect, test, type Page } from '@playwright/test';
import { openSignedIn } from '../session';

/**
 * PACQ-06 (criterio E1): en cada almacén activo, ningún botón del DOM tiene una acción fuera de
 * los permisos efectivos. `*ewmsCan` marca lo que pinta con `data-ewms-can`; los permisos
 * esperados son los de los datos de demostración del simulador.
 */

const READ = ['security.users:access', 'security.profiles:access', 'security.profiles:inspect'];
const ADMIN = [
  ...READ,
  'security.users:create',
  'security.users:update',
  'security.users:deactivate',
  'security.users:export',
  'security.profiles:update',
  'security.profiles:assign',
];
const OPERATE = ['security.users:access', 'security.users:create', 'security.users:update'];

const PEOPLE = [
  { user: 'admin', grants: { 'A/X': ADMIN, 'B/Y': ADMIN } },
  { user: 'reader', grants: { 'A/X': READ, 'B/Y': READ } },
  { user: 'operator', grants: { 'A/X': OPERATE, 'B/Y': READ } },
] as const;

const SCREENS = ['/configuracion/usuarios', '/configuracion/perfiles'];

async function shownCodes(page: Page): Promise<string[]> {
  await expect(page.locator('main#main h1').first()).toBeVisible();
  return page
    .locator('[data-ewms-can]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-ewms-can') ?? ''));
}

async function visit(page: Page, route: string): Promise<void> {
  await page.evaluate((url) => history.pushState(null, '', url), route);
  await page.evaluate(() => dispatchEvent(new PopStateEvent('popstate')));
}

for (const { user, grants } of PEOPLE) {
  test(`${user}: no button outside the effective permissions of the active warehouse`, async ({
    page,
  }) => {
    await openSignedIn(page, SCREENS[0]!, user);
    const seen = new Set<string>();
    for (const context of ['A/X', 'B/Y'] as const) {
      if (context === 'B/Y') {
        await page.locator('[data-warehouse-switcher]').getByLabel('Almacén activo').click();
        await page.getByRole('option', { name: 'Almacén B / Propietario Y', exact: true }).click();
        // El campo cambia al elegir; la sesión, cuando el servidor confirma: se espera a la sesión.
        await expect(page.locator('[data-shell-stamp]').first()).toContainText('/ B - B');
      }
      for (const route of SCREENS) {
        await visit(page, route);
        const allowed: readonly string[] = grants[context];
        for (const code of await shownCodes(page)) {
          expect(allowed, `${user} ${context} ${route}`).toContain(code);
          seen.add(code);
        }
      }
    }
    // Quien puede escribir ve sus botones: la prueba no pasa por no pintar nada.
    if (user !== 'reader') expect(seen.size).toBeGreaterThan(0);
  });
}
