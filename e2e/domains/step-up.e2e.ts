import { expect, test, type Page } from '@playwright/test';
import { axe } from '../axe';
import { watchConsole } from '../console-watch';
import { openSignedIn } from '../session';

/**
 * PACQ-05 (C8): una acción sensible solo se completa tras el segundo factor y cancelar no la
 * ejecuta. En la demostración, el servidor simulado lo pide al activar o desactivar un usuario.
 * La misma `Idempotency-Key` en el reintento se prueba en unidad (auth.interceptor.spec.ts).
 */

async function deactivateRosa(page: Page): Promise<void> {
  const row = page.locator('[data-users-page] tbody tr', { hasText: 'Rosa Consulta' });
  await row.locator('[data-kebab] button').click();
  await page.getByRole('menuitem', { name: 'Desactivar usuario', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
}

test('PACQ-05: a sensitive action completes only after the second factor', async ({ page }) => {
  const watch = await watchConsole(page);
  await openSignedIn(page, '/configuracion/usuarios');
  const row = page.locator('[data-users-page] tbody tr', { hasText: 'Rosa Consulta' });
  await expect(row).toContainText('Activo');

  // Cancelar el factor deja la acción sin ejecutar y lo dice.
  await deactivateRosa(page);
  const stepUp = page.locator('[data-step-up]');
  await expect(stepUp).toContainText('Confirme su identidad');
  await stepUp.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(page.locator('[data-users-page] [role="alert"]')).toContainText(
    'La acción no se ejecutó',
  );
  await expect(row).toContainText('Activo');

  // Un código rechazado no completa la acción; uno válido sí, una sola vez.
  await deactivateRosa(page);
  const code = stepUp.getByRole('textbox', { name: 'Código de verificación', exact: true });
  await expect(code).toBeFocused();
  const result = await axe(page)
    .include('[data-step-up]')
    .analyze();
  expect(result.violations).toEqual([]);
  await code.fill('000000');
  await stepUp.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(stepUp.getByRole('alert')).toContainText('El código no es válido');
  await expect(row).toContainText('Activo');
  await code.fill('123456');
  await stepUp.getByRole('button', { name: 'Verificar', exact: true }).click();
  await expect(stepUp).toHaveCount(0);
  await expect(row).toContainText('Inactivo');
  await expect(page.locator('[data-users-page] [role="alert"]')).toHaveCount(0);
  await watch.clean('second factor');
});
