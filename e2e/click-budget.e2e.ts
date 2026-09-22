import { expect, test, type Locator, type Page } from '@playwright/test';
/*
 * Único import profundo a projects/ del repo: el alias carga el barril de Angular en Node y falla con
 * «PlatformLocation needs to be compiled using the JIT compiler». HG-02 pide leer los presupuestos de un
 * solo archivo; tools/ci/check-click-budget.mjs falla si este import desaparece.
 */
// eslint-disable-next-line no-restricted-imports -- ver la nota de arriba
import {
  CANCEL_MAX_CLICKS,
  CREATE_MAX_CLICKS,
  EDIT_MAX_CLICKS,
  OPEN_FAVORITE_MAX_CLICKS,
  SEARCH_MAX_CLICKS,
} from '../projects/showroom/src/lib/pages/patterns/click-budget';

/*
 * Cuenta clics (REQ-FE-DS4-003 RFE-03) y prueba reglas de teclado (REQ-FE-DS4-001). Los clics los cuenta
 * un envoltorio de click y no el contador de la pantalla, que es lo que se prueba; al final se comparan:
 * si difieren, uno miente.
 */

const SCREEN = '/design-system/patterns/search-create-edit';
const SCREEN_HEADING = 'Buscar, crear, editar';
const KEYBOARD = '/design-system/patterns/keyboard';

/** Expedición que existe en los datos de la demo. */
const KNOWN_CODE = 'EXP-2026-0403';

/** Las acciones de teclado no pasan por este contador, a propósito. */
function clicker(): { click: (locator: Locator) => Promise<void>; total: () => number } {
  let total = 0;
  return {
    click: async (locator: Locator): Promise<void> => {
      total += 1;
      await locator.click();
    },
    total: () => total,
  };
}

async function resetPageCounter(page: Page): Promise<void> {
  // Por evaluate y no por clicks.click: la pantalla ignora este botón, el contador de la prueba no.
  await page.locator('[data-reset-clicks]').evaluate((button: HTMLElement) => button.click());
  await expect(page.locator('[data-click-count]')).toHaveText('0');
}

async function pageCount(page: Page): Promise<number> {
  return Number((await page.locator('[data-click-count]').innerText()).trim());
}

async function open(page: Page): Promise<void> {
  await page.goto(SCREEN);
  await expect(page.getByRole('heading', { level: 1, name: SCREEN_HEADING })).toBeVisible();
  // Con datos: un escaneo antes de la primera página no encuentra nada (1 de 120 bajo carga).
  await expect(page.locator('ewms-table tbody [role="row"][data-row]').first()).toBeVisible();
  await resetPageCounter(page);
}

/** Acotado al listbox: getByRole('option') también toma las opciones ocultas del selector de idioma. */
function results(page: Page): Locator {
  return page.locator('[role="listbox"] [role="option"]');
}

/** Deja el foco en el título, que no es control ni cuenta: el estado real en que se dispara la pistola. */
async function clickNeutral(page: Page): Promise<void> {
  await page.getByRole('heading', { level: 1, name: SCREEN_HEADING }).click();
}

/**
 * Una pistola con el foco fuera de un campo: la ráfaga entera en una sola tarea del navegador,
 * como llega de un lector. Tipeada por CDP, con cuatro workers un hueco pasaba de 150 ms y partía
 * el código («P-000123», 1 de 190). El motor oye `keydown` en el documento: es el mismo camino.
 */
async function scan(page: Page, code: string): Promise<void> {
  await page.evaluate((keys) => {
    const target = document.activeElement ?? document.body;
    for (const key of keys) {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
  }, [...code, 'Enter']);
}

test.describe('the click budget, counted', () => {
  test(`searching costs at most ${SEARCH_MAX_CLICKS} clicks with the mouse`, async ({ page }) => {
    await open(page);
    const clicks = clicker();

    await clicks.click(page.locator('[data-search-host] input'));
    await page.keyboard.type('textiles');
    const option = results(page).first();
    await expect(option).toBeVisible();
    await clicks.click(option);

    await expect(page.locator('[data-chosen]')).toContainText(KNOWN_CODE);
    expect(clicks.total(), `buscar costó ${clicks.total()} clics`).toBeLessThanOrEqual(
      SEARCH_MAX_CLICKS,
    );
    expect(await pageCount(page), 'la pantalla y la prueba cuentan distinto').toBe(clicks.total());
  });

  test(`creating costs at most ${CREATE_MAX_CLICKS} clicks with the mouse`, async ({ page }) => {
    await open(page);
    const clicks = clicker();

    await clicks.click(page.locator('[data-new-button] button'));
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
    // Teclear en el campo que el diálogo ya enfocó cuesta cero (§2.1).
    await page.keyboard.type('EXP-2026-0900');
    await clicks.click(page.locator('[data-form-save] button'));

    await expect(page.locator('[data-last-saved]')).toHaveText('EXP-2026-0900');
    expect(clicks.total(), `crear costó ${clicks.total()} clics`).toBeLessThanOrEqual(
      CREATE_MAX_CLICKS,
    );
    expect(await pageCount(page), 'la pantalla y la prueba cuentan distinto').toBe(clicks.total());
  });

  test(`editing costs at most ${EDIT_MAX_CLICKS} clicks with the mouse, finding it included`, async ({
    page,
  }) => {
    await open(page);
    const clicks = clicker();

    await clicks.click(page.locator('[data-search-host] input'));
    await page.keyboard.type('textiles');
    const option = results(page).first();
    await expect(option).toBeVisible();
    await clicks.click(option);
    await clicks.click(page.locator('[data-edit-button] button'));

    await expect(page.locator('[data-form-codigo] input')).toHaveValue(KNOWN_CODE);
    expect(clicks.total(), `editar costó ${clicks.total()} clics`).toBeLessThanOrEqual(
      EDIT_MAX_CLICKS,
    );
    expect(await pageCount(page), 'la pantalla y la prueba cuentan distinto').toBe(clicks.total());
  });

  test(`cancelling costs at most ${CANCEL_MAX_CLICKS} click, and asks nothing`, async ({
    page,
  }) => {
    await open(page);
    await page.locator('[data-new-button] button').click();
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
    await page.keyboard.type('algo que no se va a guardar');
    await resetPageCounter(page);

    const clicks = clicker();
    await clicks.click(page.locator('[data-form-cancel] button'));

    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
    // §2.2: pedir confirmación para cancelar algo nunca guardado gasta el presupuesto en una pregunta.
    await expect(page.locator('ewms-confirm-dialog')).toHaveCount(0);
    await expect(page.locator('[data-last-saved]')).toHaveText('—');
    expect(clicks.total()).toBeLessThanOrEqual(CANCEL_MAX_CLICKS);
  });
});

// Los mismos flujos por teclado cuestan cero: el operario tiene guantes y la pistola en una mano (§2.1).
test.describe('the same flows on the keyboard cost nothing', () => {
  test('searching: / then type then Enter', async ({ page }) => {
    await open(page);
    const clicks = clicker();

    await page.keyboard.press('/');
    await expect(page.locator('[data-search-host] input')).toBeFocused();
    await page.keyboard.type('textiles');
    await expect(results(page).first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-chosen]')).toContainText(KNOWN_CODE);
    expect(clicks.total(), 'buscar con teclado no puede costar ningún clic').toBe(0);
    expect(await pageCount(page)).toBe(0);
  });

  test('creating: Alt+N then type then Ctrl+S', async ({ page }) => {
    await open(page);
    const clicks = clicker();

    await page.keyboard.press('Alt+n');
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
    await page.keyboard.type('EXP-2026-0901');
    await page.keyboard.press('Control+s');

    await expect(page.locator('[data-last-saved]')).toHaveText('EXP-2026-0901');
    expect(clicks.total(), 'crear con teclado no puede costar ningún clic').toBe(0);
    expect(await pageCount(page)).toBe(0);
  });

  test('creating: Alt+N, type, and ENTER -- the limitation DS-5 closed', async ({ page }) => {
    // Hasta DS-5 todo ewms-button era de tipo button, así que Enter no enviaba el formulario.
    // DS-5 agregó la entrada type (por defecto button) y este formulario pide submit.
    await open(page);
    const clicks = clicker();

    await page.keyboard.press('Alt+n');
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
    // A ritmo de persona: a toda velocidad es una ráfaga, y ráfaga + Enter es un escaneo (RFE-05) que el
    // motor cancela. 60 ms supera el umbral; una persona real anda por 120. El costo de RFE-05 ahora
    // también se ve en el Enter de un formulario.
    await page.keyboard.type('EXP-2026-0902', { delay: 60 });
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-last-saved]')).toHaveText('EXP-2026-0902');
    expect(clicks.total(), 'guardar con Enter no puede costar ningún clic').toBe(0);
    expect(await pageCount(page)).toBe(0);
  });

  test('cancelling: Escape, one gesture, and the focus comes back', async ({ page }) => {
    await open(page);
    const opener = page.locator('[data-new-button] button');
    await opener.focus();
    await resetPageCounter(page);
    const clicks = clicker();

    await page.keyboard.press('Alt+n');
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
    await page.keyboard.type('algo');
    await page.keyboard.press('Escape');

    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
    await expect(page.locator('[data-last-saved]')).toHaveText('—');
    // El foco vuelve al origen: si no, Escape sería un gesto más buscar dónde estabas.
    await expect(opener).toBeFocused();
    expect(clicks.total()).toBe(0);
    expect(await pageCount(page)).toBe(0);
  });
});

// Favoritos (DS-5, REQ-FE-DS4-002 + REQ-FE-DS4-003 §2.2): el único presupuesto que cruza la app entera,
// con la estrella en la cabecera del App Shell y la lista en su riel.
test.describe('opening a favourite', () => {
  test(`costs at most ${OPEN_FAVORITE_MAX_CLICKS} click, from another screen`, async ({ page }) => {
    await open(page);

    // Hay dos estrellas en pantalla, la del shell y la del catálogo (otro almacén, gracias a RFE-02).
    // Se prueba el flujo de la aplicación, así que todo localizador se acota al shell.
    await page.locator('[data-app-header] [data-favorite-toggle] button').click();
    await expect(page.locator('ewms-nav-rail [data-favorite]')).toHaveCount(1);

    // Navegando dentro de la app: page.goto recargaría y la lista vive en memoria (lo afirma smoke.e2e.ts).
    await page.locator('[data-nav-item="dashboard"]').click();
    await expect(page).toHaveURL(/\/$/);

    const clicks = clicker();
    await clicks.click(page.locator('ewms-nav-rail [data-favorite]').first());

    await expect(page).toHaveURL(new RegExp(`${SCREEN}$`));
    expect(clicks.total(), `abrir un favorito costó ${clicks.total()} clics`).toBeLessThanOrEqual(
      OPEN_FAVORITE_MAX_CLICKS,
    );
  });

  test('and ZERO with the keyboard, like every other flow', async ({ page }) => {
    await open(page);
    await page.locator('[data-app-header] [data-favorite-toggle] button').click();
    await expect(page.locator('ewms-nav-rail [data-favorite]')).toHaveCount(1);
    await page.locator('[data-nav-item="dashboard"]').click();
    await expect(page).toHaveURL(/\/$/);

    const clicks = clicker();
    await page.locator('ewms-nav-rail [data-favorite]').first().press('Enter');

    await expect(page).toHaveURL(new RegExp(`${SCREEN}$`));
    expect(clicks.total()).toBe(0);
  });
});

// RFE-05 en cada superficie por separado: si falla, cuesta un movimiento de inventario equivocado.
test.describe('a scan never fires a shortcut', () => {
  test('on the screen: it chooses the shipment without opening the panel', async ({ page }) => {
    await open(page);
    await clickNeutral(page);
    await resetPageCounter(page);

    await scan(page, KNOWN_CODE);

    await expect(page.locator('[data-chosen]')).toContainText(KNOWN_CODE);
    await expect(page.locator('[data-search-host] input')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
    expect(await pageCount(page), 'un escaneo cuesta cero clics').toBe(0);
  });

  test('a code CONTAINING a shortcut character fires nothing', async ({ page }) => {
    await open(page);
    await clickNeutral(page);

    // Barra (buscar) y signo de pregunta (ayuda), los dos dentro del código.
    await scan(page, 'AB/CD?EF12');

    await expect(page.locator('ewms-shortcut-help')).toHaveCount(0);
    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
    await expect(page.locator('[data-search-host] input')).not.toBeFocused();
  });

  test('a code BEGINNING with a shortcut character fires nothing either', async ({ page }) => {
    // Con el primer carácter aún no hay ráfaga: lo salva que el motor espere una ventana de umbral.
    await open(page);
    await clickNeutral(page);

    await scan(page, '/XY9012345');

    await expect(page.locator('[data-search-host] input')).not.toBeFocused();
    await expect(page.locator('ewms-shortcut-help')).toHaveCount(0);
  });

  test('inside a text field a scan is just text, and no shortcut fires', async ({ page }) => {
    await open(page);
    await page.locator('[data-search-host] input').click();
    await resetPageCounter(page);

    await page.keyboard.type('n/a?n', { delay: 5 });

    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
    await expect(page.locator('ewms-shortcut-help')).toHaveCount(0);
    await expect(page.locator('[data-search-host] input')).toHaveValue('n/a?n');
  });

  test('on the keyboard pattern page the engine says what it decided', async ({ page }) => {
    await page.goto(KEYBOARD);
    await expect(page.getByRole('heading', { level: 1, name: 'Atajos de teclado' })).toBeVisible();

    await scan(page, 'EXP-000123');

    // Se lee la clasificación del motor (KeyboardShortcuts.events), no un efecto secundario.
    await expect(page.locator('[data-demo-last-scan]')).toHaveText('EXP-000123');
    await expect(page.locator('[data-demo-log]')).toContainText('scan');
    await expect(page.locator('[data-demo-log]')).toContainText('burst');
    await expect(page.locator('[data-demo-search-hits]')).toHaveText('0');
  });
});

// RFE-04 y RFE-07, que solo un foco real puede responder.
test.describe('the shortcut rules, in a browser', () => {
  test('no shortcut fires inside a text field, and Escape still does', async ({ page }) => {
    await open(page);
    const field = page.locator('[data-search-host] input');
    await field.click();

    // A velocidad humana, para que nada se confunda con la pistola.
    await page.keyboard.type('hola / n ?', { delay: 90 });
    await page.keyboard.press('Alt+n');

    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
    await expect(page.locator('ewms-shortcut-help')).toHaveCount(0);
    await expect(field).toHaveValue('hola / n ?');
  });

  test('Ctrl+S saves the form and never the browser page', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Alt+n');
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
    await page.locator('[data-form-codigo] input').click();
    await page.keyboard.type('EXP-2026-0902');

    // Desde dentro del campo, donde está el foco cuando alguien guarda.
    const prevented = await page.evaluate(() => {
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.activeElement?.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(prevented, 'el navegador no puede llegar a guardar la página').toBe(true);
    await expect(page.locator('[data-last-saved]')).toHaveText('EXP-2026-0902');
  });

  test('? opens the help, which lists the map and returns the focus', async ({ page }) => {
    await open(page);
    const opener = page.locator('[data-new-button] button');
    await opener.focus();

    await page.keyboard.press('?');
    const help = page.locator('ewms-shortcut-help');
    await expect(help).toBeVisible();

    await expect(help.locator('kbd')).toHaveText(['/', 'Alt', 'N', 'Ctrl', 'S', 'Esc', 'Alt', 'R', '?']);

    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('WCAG 2.1.4: the switch silences / and ?, and leaves Alt+N alone', async ({ page }) => {
    await open(page);
    await page.keyboard.press('?');
    const help = page.locator('ewms-shortcut-help');
    await expect(help).toBeVisible();

    await help.locator('input[role="switch"]').click();
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);

    await page.keyboard.press('/');
    await expect(page.locator('[data-search-host] input')).not.toBeFocused();
    await page.keyboard.press('?');
    await expect(page.locator('ewms-shortcut-help')).toHaveCount(0);

    // Los que llevan modificador siguen: 2.1.4 trata de teclas de un solo carácter.
    await page.keyboard.press('Alt+n');
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
  });
});
