import { expect, test } from '@playwright/test';

test('the shell boots and renders the home page', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'eWMS Advance' })).toBeVisible();
});

test('the showroom route responds at /design-system', async ({ page }) => {
  await page.goto('/design-system');

  await expect(page.getByRole('heading', { name: /sistema de diseno/i })).toBeVisible();
});
