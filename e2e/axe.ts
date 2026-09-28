import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * axe con WCAG 2.2 AA completo: los tags de cada nivel más buenas prácticas, que es el mismo
 * conjunto que corría sin tags (96 reglas), y `target-size` (2.5.8), que axe trae apagada.
 * No es un spec. Ver vault: Que nos obliga a nosotros §2.
 */
export const WCAG_22_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

export function axe(page: Page): AxeBuilder {
  return new AxeBuilder({ page })
    .withTags(WCAG_22_AA)
    .options({ rules: { 'target-size': { enabled: true } } });
}
