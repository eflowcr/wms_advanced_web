import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { watchConsole } from '../console-watch';

test('module search and grant filter preserve hidden permissions and preview the draft', async ({
  page,
}) => {
  const watch = await watchConsole(page);
  await page.goto('/configuracion/perfiles');
  await expect(page.locator('[data-permission-module]')).toHaveCount(3);
  const summary = page.locator('[data-profile-summary]');
  await expect(summary).toContainText('13 pantallas y 7 acciones concedidas');
  await page.locator('[data-security-page]').getByLabel('Perfil', { exact: true }).first().click();
  await page.getByRole('option', { name: 'Consultation', exact: true }).click();
  await expect(summary).toContainText('2 pantallas y 1 acción concedida');
  const filter = page.getByLabel('Solo con permisos', { exact: true });
  await filter.check();
  await page.getByLabel('Buscar pantallas o módulos').fill('Configuración');
  await expect(page.locator('[data-permission-module]')).toHaveCount(1);
  await expect(page.locator('[data-permission-matrix] fieldset')).toHaveCount(2);
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  const usersView = page
    .getByRole('group', { name: 'Usuarios', exact: true })
    .getByLabel('Consultar pantalla');
  await expect(usersView).toBeChecked();
  // La tarjeta desaparece con el clic; el contrato se verifica sobre el resultado filtrado.
  await usersView.click();
  await expect(page.locator('[data-permission-matrix] fieldset')).toHaveCount(1);
  await expect(filter).toBeFocused();
  await expect(summary).toContainText('1 pantalla y 1 acción concedida');
  await expect(summary).toContainText('Vista previa del borrador');
  await expect(
    page
      .getByRole('group', { name: 'Seguridad', exact: true })
      .getByLabel('Consultar acceso resultante'),
  ).toBeChecked();
  await page
    .locator('[data-profile-form]')
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await expect(summary).toContainText('2 pantallas y 1 acción concedida');
  await expect(page.locator('[data-permission-matrix] fieldset')).toHaveCount(2);
  await page.getByLabel('Buscar pantallas o módulos').fill('inexistente');
  await expect(page.locator('[data-permission-matrix] fieldset')).toHaveCount(0);
  await expect(summary).toContainText('2 pantallas y 1 acción concedida');
  await watch.clean('filtered matrix and draft');
});

test('profile grants are saved, assigned and explained by provenance', async ({ page }) => {
  const watch = await watchConsole(page);
  await page.goto('/configuracion/perfiles');
  await page.getByRole('button', { name: 'Crear perfil', exact: true }).click();
  await page.locator('[data-profile-form]').getByLabel('Nombre').fill('Exportación adicional');
  const users = page.getByRole('group', { name: 'Usuarios', exact: true });
  await users.getByLabel('Consultar pantalla', { exact: true }).check();
  await users.getByLabel('Exportar / copiar usuarios', { exact: true }).check();
  await page
    .locator('[data-profile-form]')
    .getByRole('button', { name: 'Revisar y guardar' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-profile-form]')).toHaveCount(0);
  const root = page.locator('[data-security-page]');
  await root.getByLabel('Perfil', { exact: true }).nth(1).click();
  await page.getByRole('option', { name: 'Exportación adicional', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir asignación', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar y guardar', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Exportación adicional');
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-effective-access]')).toContainText('Exportación adicional');
  await watch.clean('grant and assignment');
});

test('a scoped screen action enables its button and operation without granting other actions', async ({
  page,
}) => {
  const watch = await watchConsole(page);
  await page.goto('/configuracion/perfiles');
  await page.getByRole('button', { name: 'Crear perfil', exact: true }).click();
  await page.locator('[data-profile-form]').getByLabel('Nombre').fill('Alta de usuarios');
  const users = page.getByRole('group', { name: 'Usuarios', exact: true });
  await users.getByLabel('Crear usuarios', { exact: true }).check();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Conceder acceso a la pantalla', exact: true })
    .click();
  await expect(users.getByLabel('Consultar pantalla', { exact: true })).toBeChecked();
  await expect(page.locator('[data-profile-summary]')).toContainText(
    '1 pantalla y 1 acción concedida',
  );
  await page
    .locator('[data-profile-form]')
    .getByRole('button', { name: 'Revisar y guardar' })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-profile-form]')).toHaveCount(0);
  await page.locator('[data-security-page]').getByLabel('Perfil', { exact: true }).nth(1).click();
  await page.getByRole('option', { name: 'Alta de usuarios', exact: true }).click();
  await page.getByRole('button', { name: 'Añadir asignación', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar y guardar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('[data-effective-access]')).toContainText('Alta de usuarios');
  await page.locator('[data-security-demo]').getByLabel('Escenario').click();
  await page.getByRole('option', { name: 'Consulta', exact: true }).click();
  await page.locator('[data-nav-item="settings"]').click();
  await page.locator('[data-nav-item="users"]').click();
  await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
  await page.locator('[data-user-form]').getByLabel('Nombre').fill('Usuario con concesión');
  await page
    .locator('[data-user-form]')
    .getByRole('button', { name: 'Guardar', exact: true })
    .click();
  await expect(page.locator('[data-users-page]')).toContainText('Usuario con concesión');
  await page.getByText('Usuario con concesión', { exact: true }).dblclick();
  await expect(page.locator('[data-user-form]')).toHaveCount(0);
  await expect(page.locator('[data-users-page] [data-export]')).toHaveCount(0);
  await page.locator('[data-security-demo]').getByLabel('Almacén / propietario').click();
  await page.getByRole('option', { name: 'Almacén B / Propietario Y', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Crear usuario', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-users-page]')).not.toContainText('Usuario con concesión');
  await watch.clean('scoped screen action');
});

test('limited operation loses editing on a context change and discards its draft', async ({
  page,
}) => {
  await page.goto('/configuracion/usuarios');
  const demo = page.locator('[data-security-demo]');
  await demo.getByLabel('Escenario').click();
  await page.getByRole('option', { name: 'Operación limitada', exact: true }).click();
  await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
  await page.locator('[data-user-form]').getByLabel('Nombre').fill('Borrador anterior');
  await demo.getByLabel('Almacén / propietario').click();
  await page.getByRole('option', { name: 'Almacén B / Propietario Y', exact: true }).click();
  await expect(page.locator('[data-user-form]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Crear usuario', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-users-page] tbody')).toBeVisible();
  await expect(page.locator('[data-users-page]')).not.toContainText('Borrador anterior');
});

test('revocation while Security is open hides data and redirects without a loop', async ({
  page,
}) => {
  await page.goto('/configuracion/perfiles');
  await expect(page.locator('[data-permission-matrix]')).toBeVisible();
  await page.locator('[data-app-header] [data-favorite-toggle] button').click();
  await page.locator('[data-security-demo]').getByLabel('Escenario').click();
  await page.getByRole('option', { name: 'Operación limitada', exact: true }).click();
  await expect(page).toHaveURL(/\/\?access=denied$/);
  await expect(page.locator('[data-security-page]')).toHaveCount(0);
  await expect(page.locator('[data-nav-item="profiles"]')).toHaveCount(0);
  await expect(page.locator('[data-favorite="/configuracion/perfiles"]')).toHaveCount(0);
  await expect(page.locator('[data-tab]')).not.toContainText('Seguridad');
});

test('authorized routes open tabs and keyboard Delete restores the neighbouring page', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-nav-item="settings"]').click();
  await page.locator('[data-nav-item="users"]').click();
  await expect(page).toHaveTitle(/Usuarios/);
  await page.locator('[data-nav-item="profiles"]').click();
  await expect(page).toHaveTitle(/Seguridad/);
  await page.locator('[data-nav-item="params"]').click();
  await expect(page.locator('[data-tab]')).toHaveCount(4);
  await page.locator('[data-tab][aria-selected="true"]').press('Delete');
  await expect(page.locator('[data-tab]')).toHaveCount(3);
  await expect(page.locator('[data-tab][aria-selected="true"]')).toHaveText('Seguridad');
  await expect(page.locator('[data-security-page] h1')).toBeFocused();
});

test('administrator creates a user, edits a profile and cancels without committing', async ({
  page,
}) => {
  await page.goto('/configuracion/usuarios');
  await expect(page.locator('[data-users-page]')).toBeVisible();
  await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
  await page.locator('[data-user-form]').getByLabel('Nombre').fill('Usuario de prueba');
  await page
    .locator('[data-user-form]')
    .getByRole('button', { name: 'Guardar', exact: true })
    .click();
  await expect(page.locator('[data-users-page]')).toContainText('Usuario de prueba');
  await page.goto('/configuracion/perfiles');
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  await page.locator('[data-profile-form]').getByLabel('Nombre').fill('Discarded name');
  await page
    .locator('[data-profile-form]')
    .getByRole('button', { name: 'Cancelar', exact: true })
    .click();
  await expect(page.locator('[data-profile-form]')).toHaveCount(0);
  await expect(page.locator('[data-security-page]')).not.toContainText('Discarded name');
});

test('user search and state filters restrict the visible rows and survive a reload', async ({
  page,
}) => {
  await page.goto('/configuracion/usuarios');
  const table = page.locator('[data-users-page] ewms-table');
  await expect(table).toContainText('Ana Admin');
  const search = page.getByLabel('Buscar por nombre o identificador', { exact: true });
  await search.fill('Rosa');
  await expect(table).toContainText('Rosa Consulta');
  await expect(table).not.toContainText('Ana Admin');
  await search.fill('');
  await page.getByRole('combobox', { name: 'Estado', exact: true }).click();
  await page.getByRole('option', { name: 'Inactivo', exact: true }).click();
  await expect(table).toContainText('Usuario inactivo');
  await expect(table).not.toContainText('Rosa Consulta');
  await expect(page).toHaveURL(/state=inactive/);
  await page.reload();
  await expect(table).toContainText('Usuario inactivo');
  await expect(table).not.toContainText('Ana Admin');
});

test('consultation cannot create, export, copy or administer, including keyboard', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/configuracion/usuarios');
  await page.locator('[data-security-demo]').getByLabel('Escenario').click();
  await page.getByRole('option', { name: 'Consulta' }).click();
  await expect(page.getByRole('button', { name: 'Crear usuario', exact: true })).toHaveCount(0);
  await page.keyboard.press('Alt+n');
  await expect(page.locator('[data-user-form]')).toHaveCount(0);
  await page.evaluate(() => navigator.clipboard.writeText('unchanged'));
  const cell = page.locator('[data-users-page] tbody td').first();
  await cell.click();
  await page.keyboard.press('Control+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('unchanged');
  await page.locator('[data-nav-item="settings"]').click();
  await page.locator('[data-nav-item="profiles"]').click();
  await expect(page.getByRole('button', { name: 'Crear perfil', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-effective-access]')).toBeVisible();
});

for (const locale of ['es-CR', 'en-US']) {
  test(`Security and Users are accessible without global overflow at desktop and mobile (${locale})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/configuracion/perfiles', '/configuracion/usuarios']) {
        await page.goto(route);
        await expect(page.locator('[data-security-page], [data-users-page]')).toBeVisible();
        await expect(
          page.locator(
            route === '/configuracion/perfiles'
              ? '[data-permission-matrix]'
              : '[data-users-page] ewms-table',
          ),
        ).toBeVisible();
        if (locale === 'es-CR' && route === '/configuracion/perfiles')
          await page.screenshot({ path: `.angular/cache/matrix-${width}.png` });
        await expect(page.locator('main#main')).not.toContainText('security.');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const result = await new AxeBuilder({ page })
          .include('main#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(result.violations).toEqual([]);
      }
    }
    await context.close();
  });
}

test('mobile navigation sheet traps focus and returns it on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const more = page.locator('[data-nav-bottom-more]');
  await more.click();
  const sheet = page.locator('[data-nav-bottom-sheet]');
  await expect(sheet).toHaveAttribute('aria-modal', 'true');
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await expect
    .poll(() => page.locator('#main h1').evaluate((el) => el.closest('[inert]') !== null))
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
});
