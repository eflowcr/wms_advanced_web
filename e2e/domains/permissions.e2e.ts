import { expect, test, type Page } from '@playwright/test';
import { openSignedIn } from '../session';

/**
 * PACQ-06 (criterio E1): en cada almacén activo, ningún botón del DOM tiene una acción fuera de
 * los permisos efectivos: lo que pinta `*ewmsCan` (`data-ewms-can`) y las acciones de fila y la
 * exportación de Usuarios, que arma la tabla. Los permisos son los de la demostración.
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

/** Lo que la tabla de Usuarios ofrece fuera de `*ewmsCan`, con el código que lo concede. */
const ROW_ACTIONS: Readonly<Record<string, string>> = {
  'Editar usuario': 'security.users:update',
  'Desactivar usuario': 'security.users:deactivate',
  'Activar usuario': 'security.users:deactivate',
};

async function tableCodes(page: Page): Promise<string[]> {
  const users = page.locator('[data-users-page]');
  if ((await users.count()) === 0) return [];
  await expect(users.locator('tbody tr').first()).toBeVisible();
  const codes = (await users.locator('[data-export]').count()) ? ['security.users:export'] : [];
  const rows = await users.locator('tbody tr').count();
  for (let row = 0; row < rows; row++) {
    const kebab = users.locator(`[data-kebab="${row}"] button`);
    if ((await kebab.count()) === 0) continue;
    await kebab.click();
    for (const item of await page.getByRole('menuitem').allTextContents())
      codes.push(ROW_ACTIONS[item.trim()] ?? `unknown: ${item.trim()}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
  }
  return codes;
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
        for (const code of [...(await shownCodes(page)), ...(await tableCodes(page))]) {
          expect(allowed, `${user} ${context} ${route}`).toContain(code);
          seen.add(code);
        }
      }
    }
    // Quien puede escribir ve sus botones: la prueba no pasa por no pintar nada.
    if (user !== 'reader') expect(seen.size).toBeGreaterThan(0);
  });
}
