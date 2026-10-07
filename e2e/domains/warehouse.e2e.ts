import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { watchConsole } from '../console-watch';
import { openSignedIn } from '../session';

/** REQ-FE-SEC-002, RFE-04: el almacén activo, contra el simulador del contrato. */

const switcher = (page: Page) =>
  page.locator('[data-warehouse-switcher]').getByLabel('Almacén activo');

async function chooseWarehouse(page: Page, name: string): Promise<void> {
  await switcher(page).click();
  await page.getByRole('option', { name, exact: true }).click();
}

interface WindowWithMark extends Window {
  __sameDocument?: boolean;
}

// PACQ-01: dos almacenes, sin reautenticarse y sin recargar.
test('switching warehouse recalculates the buttons without signing in again or reloading', async ({
  page,
}) => {
  const watch = await watchConsole(page);
  await openSignedIn(page, '/configuracion/usuarios', 'operator');
  const create = page.getByRole('button', { name: 'Crear usuario', exact: true });
  await expect(create).toBeVisible();
  await expect(switcher(page)).toHaveValue('Almacén A / Propietario X');
  await page.evaluate(() => ((window as WindowWithMark).__sameDocument = true));

  await chooseWarehouse(page, 'Almacén B / Propietario Y');
  await expect(create).toHaveCount(0);
  await expect(page.locator('[data-users-page] tbody')).toBeVisible();
  await chooseWarehouse(page, 'Almacén A / Propietario X');
  await expect(create).toBeVisible();

  await expect(page.locator('[data-login-form]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as WindowWithMark).__sameDocument)).toBe(true);
  await watch.clean('warehouse switch');
});

// PACQ-09: el servidor bloquea el cambio; el almacén se conserva y se dice el motivo.
test('a change refused by a running task keeps the warehouse and says why', async ({ page }) => {
  await openSignedIn(page, '/configuracion/usuarios', 'operator');
  const create = page.getByRole('button', { name: 'Crear usuario', exact: true });
  await expect(create).toBeVisible();
  await page.locator('[data-security-demo]').getByText('Simular una tarea en ejecución').click();

  await chooseWarehouse(page, 'Almacén B / Propietario Y');
  await expect(
    page.getByText('No se puede cambiar de almacén mientras hay una tarea en ejecución.'),
  ).toBeVisible();
  await expect(switcher(page)).toHaveValue('Almacén A / Propietario X');
  await expect(create).toBeVisible();
});

test('the active warehouse is always visible and its selector is accessible', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await openSignedIn(page, '/');
    await expect(switcher(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const result = await new AxeBuilder({ page })
      .include('[data-app-header]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
