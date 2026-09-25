import type { Page } from '@playwright/test';

/**
 * Cambia de idioma como una persona: abre el conmutador de la cabecera, que se encuentra por su
 * etiqueta en el idioma en pantalla, y elige la opción por su `lang`. No es un spec.
 */
export async function chooseLanguage(page: Page, label: string, lang: 'es' | 'en'): Promise<void> {
  await page.getByLabel(label, { exact: true }).click();
  await page.locator(`[role="option"][lang="${lang}"]`).click();
}
