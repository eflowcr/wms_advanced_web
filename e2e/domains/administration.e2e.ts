import { expect, test, type Page } from '@playwright/test';
import { axe } from '../axe';
import { watchConsole } from '../console-watch';
import { openSignedIn } from '../session';

/**
 * Administración del paso 4 contra el simulador: asignaciones propias (PACQ-04), separación de
 * funciones (PACQ-04), usuario externo (PACQ-03), alta masiva y vigencia.
 */

async function chooseUser(page: Page, name: string): Promise<void> {
  await page.locator('[data-security-page]').getByLabel('Usuario', { exact: true }).click();
  await page.getByRole('option', { name, exact: true }).click();
}

async function chooseAssignmentProfile(page: Page, name: string): Promise<void> {
  await page.locator('[data-security-page]').getByLabel('Perfil', { exact: true }).nth(1).click();
  await page.getByRole('option', { name, exact: true }).click();
}

test('PACQ-04: the administrator cannot modify their own assignments', async ({ page }) => {
  await openSignedIn(page, '/configuracion/perfiles');
  await chooseUser(page, 'Ana Admin');
  await expect(page.locator('[data-own-assignments]')).toContainText(
    'Sus propias asignaciones no se modifican',
  );
  await expect(page.getByRole('button', { name: 'Añadir asignación', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-assignments]').getByRole('button')).toHaveCount(0);
  await chooseUser(page, 'Rosa Consulta');
  await expect(page.locator('[data-own-assignments]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Añadir asignación', exact: true })).toBeVisible();
});

test('PACQ-04: segregation of duties is rejected with its reason and keeps the draft', async ({
  page,
}) => {
  const watch = await watchConsole(page);
  await openSignedIn(page, '/configuracion/perfiles');
  await chooseUser(page, 'Rosa Consulta');
  for (const profile of ['Administrator', 'Access audit']) {
    await chooseAssignmentProfile(page, profile);
    await page.getByRole('button', { name: 'Añadir asignación', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Revisar y guardar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  const alert = page.locator('[data-security-page] [role="alert"]');
  await expect(alert).toContainText('separación de funciones');
  await expect(alert).toContainText('Administrator, Access audit');
  await expect(page.locator('[data-assignments]')).toContainText('Access audit');
  await watch.clean('segregation rejection');
});

test('PACQ-03: an external user is offered only its company and non-internal profiles', async ({
  page,
}) => {
  const watch = await watchConsole(page);
  await openSignedIn(page, '/configuracion/perfiles');
  await chooseUser(page, 'Carla Externa');
  await expect(page.locator('[data-affiliation]')).toContainText('Externa');
  await page.locator('[data-security-page]').getByLabel('Almacén / propietario', { exact: true }).click();
  await expect(page.getByRole('option')).toHaveText(['B / Y']);
  await page.keyboard.press('Escape');
  await page.locator('[data-security-page]').getByLabel('Perfil', { exact: true }).nth(1).click();
  await expect(page.getByRole('option')).toHaveText(['Catalog consultation']);
  await page.keyboard.press('Escape');

  // Un rechazo del servidor se muestra con su mensaje: Rosa tiene perfiles de módulos internos.
  await page.locator('[data-nav-item="users"]').click();
  await page.getByText('Rosa Consulta', { exact: true }).dblclick();
  const form = page.locator('[data-user-form]');
  await form.getByLabel('Externa', { exact: true }).check();
  await form.getByRole('combobox', { name: 'Compañía', exact: true }).click();
  await page.getByRole('option', { name: 'Y', exact: true }).click();
  await form.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-users-page] [role="alert"]')).toContainText(
    'Un usuario externo no puede recibir perfiles de módulos internos',
  );
  await expect(form).toBeVisible();
  await watch.clean('external affiliation rejection');
});

test('bulk assignment creates explicit rows with their validity, all at once', async ({
  page,
}) => {
  const watch = await watchConsole(page);
  await openSignedIn(page, '/configuracion/perfiles');
  await page.getByRole('button', { name: 'Asignación masiva', exact: true }).click();
  const bulk = page.locator('[data-bulk-assignment]');
  await expect(bulk.locator('[data-bulk-users]')).not.toContainText('Ana Admin');
  await bulk.getByLabel('Luis Operación', { exact: true }).check();
  await bulk.getByLabel('Rosa Consulta', { exact: true }).check();
  await bulk.getByLabel('A / X', { exact: true }).check();
  await bulk.getByLabel('Perfil', { exact: true }).click();
  await page.getByRole('option', { name: 'Catalog consultation', exact: true }).click();
  await bulk.getByLabel('Vigencia', { exact: true }).fill('1/1/2999 – 31/12/2999');
  await bulk.getByLabel('Vigencia', { exact: true }).press('Tab');
  await expect(bulk.locator('[data-bulk-preview]')).toContainText('2 asignaciones nuevas');
  const result = await axe(page)
    .include('[data-bulk-assignment]')
    .analyze();
  expect(result.violations).toEqual([]);
  await bulk.getByRole('button', { name: 'Revisar y guardar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('2 asignaciones');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(bulk).toHaveCount(0);
  await chooseUser(page, 'Luis Operación');
  const row = page.locator('[data-assignments] li', { hasText: 'Catalog consultation' });
  await expect(row).toContainText('2999-01-01');
  await expect(row).toContainText('Programada');
  await watch.clean('bulk assignment');
});
