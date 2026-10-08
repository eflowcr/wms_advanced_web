import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { watchConsole } from '../console-watch';
import { openSignedIn } from '../session';

/**
 * Revisión de accesos (paso 4) contra el simulador, en español e inglés: iniciar una campaña,
 * confirmar y retirar por asignación con autor y fecha, y no decidir sobre el propio acceso.
 */

const TEXT = {
  'es-CR': {
    start: 'Iniciar campaña',
    name: 'Nombre de la campaña',
    due: 'Fecha límite',
    create: 'Iniciar',
    confirm: 'Confirmar',
    revoke: 'Retirar',
    dialogRevoke: 'Retirar',
    decided: 'Decidió Ana Admin',
    own: 'Su propio acceso lo revisa otra persona.',
    confirmed: 'Confirmada',
    revoked: 'Retirada',
    progress: '2 de',
  },
  'en-US': {
    start: 'Start campaign',
    name: 'Campaign name',
    due: 'Due date',
    create: 'Start',
    confirm: 'Confirm',
    revoke: 'Revoke',
    dialogRevoke: 'Revoke',
    decided: 'Decided by Ana Admin',
    own: 'Another person reviews your own access.',
    confirmed: 'Confirmed',
    revoked: 'Revoked',
    progress: '2 of',
  },
} as const;

for (const [locale, t] of Object.entries(TEXT)) {
  test(`an access review campaign confirms and revokes with author and date (${locale})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    const watch = await watchConsole(page);
    await openSignedIn(page, '/configuracion/perfiles');
    const review = page.locator('[data-access-review]');
    await review.getByRole('button', { name: t.start, exact: true }).click();
    const form = review.locator('[data-review-form]');
    await form.getByRole('textbox', { name: t.name, exact: true }).fill('Q4 2026');
    await form
      .getByRole('textbox', { name: t.due, exact: true })
      .fill(locale === 'es-CR' ? '31/12/2999' : '12/31/2999');
    await form.getByRole('textbox', { name: t.due, exact: true }).press('Tab');
    await form.getByRole('button', { name: t.create, exact: true }).click();
    await expect(review.locator('[data-review-progress]')).toContainText('Q4 2026');

    const rosa = review.locator('[data-review-items] li', { hasText: 'Rosa Consulta' }).first();
    await rosa.getByRole('button', { name: t.confirm, exact: true }).click();
    await expect(rosa).toContainText(t.confirmed);
    await expect(rosa.locator('[data-review-author]')).toContainText(t.decided);

    const luis = review.locator('[data-review-items] li', { hasText: 'Limited operation' }).first();
    await luis.getByRole('button', { name: t.revoke, exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: t.dialogRevoke, exact: true })
      .click();
    await expect(luis).toContainText(t.revoked);
    await expect(review.locator('[data-review-progress]')).toContainText(t.progress);

    const own = review.locator('[data-review-items] li', { hasText: 'Ana Admin' }).first();
    await expect(own.locator('[data-review-own]')).toHaveText(t.own);
    await expect(own.getByRole('button')).toHaveCount(0);

    const result = await new AxeBuilder({ page })
      .include('[data-access-review]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    await watch.clean(`access review ${locale}`);
    await context.close();
  });
}

test('consultation does not see the access review', async ({ page }) => {
  await openSignedIn(page, '/configuracion/perfiles', 'reader');
  await expect(page.locator('[data-security-page] h1')).toBeVisible();
  await expect(page.locator('[data-access-review]')).toHaveCount(0);
});
