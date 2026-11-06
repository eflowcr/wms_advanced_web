import { expect, test, type Page } from '@playwright/test';
import { CREATE_MAX_CLICKS, EDIT_MAX_CLICKS, SEARCH_MAX_CLICKS, clicker } from '../click-budget';
import { openSignedIn } from '../session';

/*
 * REQ-FE-DS4-003 en las pantallas de dominio: buscar, crear y editar en Usuarios y en Seguridad,
 * con ratón y por el camino más corto (§2.1). Escribir en un campo que ya tiene el foco cuesta cero.
 */

const USERS = '/configuracion/usuarios';
const PROFILES = '/configuracion/perfiles';

async function openUsers(page: Page): Promise<void> {
  await openSignedIn(page, USERS);
  await expect(page.locator('[data-users-page] ewms-table tbody [role="row"]').first()).toBeVisible();
}

async function openProfiles(page: Page): Promise<void> {
  await openSignedIn(page, PROFILES);
  await expect(page.locator('[data-permission-matrix] fieldset').first()).toBeVisible();
}

const rows = (page: Page) => page.locator('[data-users-page] ewms-table tbody [role="row"]');

test.describe('click budget of the domain screens (REQ-FE-DS4-003)', () => {
  test(`Users: searching costs at most ${SEARCH_MAX_CLICKS} clicks`, async ({ page }) => {
    await openUsers(page);
    const clicks = clicker();
    await clicks.click(page.locator('[data-user-filters] input').first());
    await page.keyboard.type('Rosa');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page)).toContainText('Rosa Consulta');
    expect(clicks.total(), `buscar costó ${clicks.total()} clics`).toBeLessThanOrEqual(SEARCH_MAX_CLICKS);
  });

  test(`Users: creating costs at most ${CREATE_MAX_CLICKS} clicks`, async ({ page }) => {
    await openUsers(page);
    const clicks = clicker();
    await clicks.click(page.locator('[data-user-create] button'));
    const form = page.locator('[data-user-form]');
    await expect(form.locator('input').first()).toBeFocused();
    await page.keyboard.type('Nora Nueva');
    await clicks.click(form.locator('button[type="submit"]'));
    await expect(form).toHaveCount(0);
    await expect(page.locator('[data-users-page] ewms-table')).toContainText('Nora Nueva');
    expect(clicks.total(), `crear costó ${clicks.total()} clics`).toBeLessThanOrEqual(CREATE_MAX_CLICKS);
  });

  test(`Users: editing, finding included, costs at most ${EDIT_MAX_CLICKS} clicks`, async ({ page }) => {
    await openUsers(page);
    const clicks = clicker();
    await clicks.click(page.locator('[data-user-filters] input').first());
    await page.keyboard.type('Rosa');
    await expect(rows(page)).toHaveCount(1);
    await clicks.dblclick(rows(page).first().locator('[role="gridcell"]').nth(1));
    const form = page.locator('[data-user-form]');
    await expect(form.locator('input').first()).toHaveValue('Rosa Consulta');
    expect(clicks.total(), `editar costó ${clicks.total()} clics`).toBeLessThanOrEqual(EDIT_MAX_CLICKS);
  });

  test(`Security: searching a screen costs at most ${SEARCH_MAX_CLICKS} clicks`, async ({ page }) => {
    await openProfiles(page);
    const clicks = clicker();
    await clicks.click(page.locator('[data-screen-search] input'));
    await page.keyboard.type('Usuarios');
    await expect(page.locator('[data-permission-matrix] fieldset')).toHaveCount(1);
    await expect(page.locator('[data-permission-matrix] legend')).toHaveText('Usuarios');
    expect(clicks.total(), `buscar costó ${clicks.total()} clics`).toBeLessThanOrEqual(SEARCH_MAX_CLICKS);
  });

  test(`Security: editing a profile, finding included, costs at most ${EDIT_MAX_CLICKS} clicks`, async ({
    page,
  }) => {
    await openProfiles(page);
    const clicks = clicker();
    await clicks.click(page.locator('[data-security-page] ewms-select').first().locator('input'));
    await clicks.click(page.getByRole('option', { name: 'Consultation', exact: true }));
    await clicks.click(page.locator('[data-profile-edit] button'));
    await expect(page.locator('[data-profile-form] input')).toHaveValue('Consultation');
    expect(clicks.total(), `editar costó ${clicks.total()} clics`).toBeLessThanOrEqual(EDIT_MAX_CLICKS);
  });
});
