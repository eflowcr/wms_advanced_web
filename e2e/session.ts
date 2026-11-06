import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

/**
 * La sesión en las E2E (ADR 0022). Producción no tiene simulador: `page.route` responde como la
 * API Go del Security Core con una sesión sin concesiones, igual que la denegación por defecto.
 * No es un spec.
 */

const SECURITY = '**/api/v1/security/**';

/** Quien abre la sesión de producción; las vistas de tabla se guardan con su nombre. */
const PERSON = { userId: 'e2e', name: 'Operador', warehouseId: '0001', ownerId: '' };

export async function serveSession(target: BrowserContext | Page): Promise<void> {
  await target.route(SECURITY, (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/auth/refresh'))
      return route.fulfill({ json: { access_token: 'e2e-access', expires_in: 900 } });
    if (pathname.endsWith('/auth/me'))
      return route.fulfill({
        json: {
          principal_id: PERSON.userId,
          username: PERSON.userId,
          display_name: PERSON.name,
          active_warehouse_id: PERSON.warehouseId,
        },
      });
    if (pathname.endsWith('/auth/contexts'))
      return route.fulfill({
        json: [{ warehouse_id: PERSON.warehouseId, owner_id: PERSON.ownerId }],
      });
    if (pathname.endsWith('/security/effective-permissions'))
      return route.fulfill({
        json: { principal_id: PERSON.userId, active_warehouse_id: PERSON.warehouseId, permissions: [] },
      });
    return route.fulfill({ status: 404, json: {} });
  });
}

/** El `test` de las suites sobre producción: cada contexto nace con la sesión servida. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await serveSession(context);
    await use(context);
  },
});

export { expect };

/** La contraseña de las E2E de demostración: el simulador acepta cualquiera que no esté vacía. */
export const DEMO_PASSWORD = 'clave-e2e-7Q';

/** Inicia sesión desde la pantalla de login, en cualquier idioma, y espera volver a la consola. */
export async function signIn(page: Page, user = 'admin'): Promise<void> {
  const form = page.locator('[data-login-form]');
  await form.locator('input[autocomplete="username"]').fill(user);
  await form.locator('input[autocomplete="current-password"]').fill(DEMO_PASSWORD);
  await form.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** En la demostración la sesión vive en memoria: cada carga de página pide iniciarla otra vez. */
export async function openSignedIn(page: Page, url: string, user = 'admin'): Promise<void> {
  await page.goto(url);
  await signIn(page, user);
}

/** La franja cambia de persona iniciando sesión en el simulador: se espera a que la cabecera la muestre. */
export async function chooseScenario(page: Page, scenario: string, person: string): Promise<void> {
  await page.locator('[data-security-demo]').getByLabel('Escenario').click();
  await page.getByRole('option', { name: scenario, exact: true }).click();
  await expect(page.locator('[data-shell-stamp]').first()).toContainText(person);
}
