import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { KEYBOARD, PAGES, ROUTE_BUDGET_MS, SEARCH_CREATE_EDIT, UNDER_CONSTRUCTION } from './routes';
import { watchConsole } from './console-watch';

/**
 * Piso de la suite: corre en todo PR y todo push. Entra solo lo que, si falla, deja a nadie usar la app;
 * un flujo por patrón y por teclado (REQ-FE-DS4-003 §2.1). Tope: doce pruebas.
 * Ver vault: Integracion Continua (4.1, los tres niveles).
 */

const KNOWN_CODE = 'EXP-2026-0403';

test.describe('the application is alive', () => {
  test('the shell boots and renders the home page', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'eWMS Advance' })).toBeVisible();
  });

  test('the showroom route responds at /design-system', async ({ page }) => {
    await page.goto('/design-system');

    await expect(page.getByRole('heading', { name: /sistema de dise(n|ñ)o/i })).toBeVisible();
  });

  // Una sola prueba para todas las rutas: veinticuatro pagarían un contexto de navegador cada una
  // para saber solo si la ruta responde. La lista se importa, así una ruta nueva entra sola.
  test('every route in the catalogue answers, with a clean console', async ({ page }) => {
    test.setTimeout(PAGES.length * ROUTE_BUDGET_MS);
    const watch = await watchConsole(page);
    for (const { url, heading } of PAGES) {
      const response = await page.goto(url);
      expect(response?.status(), `${url} no respondió`).toBeLessThan(400);
      await expect(
        page.getByRole('heading', { level: 1, name: heading.es }),
        `${url} no renderizó su h1`,
      ).toBeVisible();
      await watch.clean(url);
    }
  });
});

test.describe('the patterns still work, on the keyboard', () => {
  // Defiende el cableado: el motor de atajos llega a la pantalla, el buscador responde,
  // el diálogo abre con foco y Ctrl+S guarda el formulario y no la página del navegador.
  test('buscar, crear y editar, sin tocar el ratón', async ({ page }) => {
    await page.goto(SEARCH_CREATE_EDIT);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Buscar, crear, editar' }),
    ).toBeVisible();

    // Crear va primero a propósito: Alt+N no dispara dentro de un campo (REQ-FE-DS4-001 PACQ-02.5)
    // y elegir un resultado deja el foco en el buscador, así que buscar antes haría fallar la prueba.
    await page.keyboard.press('Alt+n');
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
    await page.keyboard.type('EXP-2026-0990');
    await page.keyboard.press('Control+s');
    await expect(page.locator('[data-last-saved]')).toHaveText('EXP-2026-0990');

    await page.keyboard.press('/');
    await expect(page.locator('[data-search-host] input')).toBeFocused();
    // El registro recién guardado ya ocupa el campo: Ctrl+A para que la búsqueda lo reemplace.
    await page.keyboard.press('Control+a');
    await page.keyboard.type('textiles');
    await expect(page.locator('[role="listbox"] [role="option"]').first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-chosen]')).toContainText(KNOWN_CODE);

    await page.locator('[data-edit-button] button').press('Enter');
    await expect(page.locator('[data-form-codigo] input')).toHaveValue(KNOWN_CODE);

    // Escape cancela siempre, sin preguntar.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
  });

  // El lector de códigos se presenta como teclado: un atajo a mitad de escaneo es un movimiento de
  // inventario equivocado. Los casos completos están en showroom; acá, el código que empieza por atajo.
  test('un escaneo que empieza por una tecla de atajo no dispara nada', async ({ page }) => {
    await page.goto(KEYBOARD);
    await page.getByRole('heading', { level: 1, name: 'Atajos de teclado' }).click();

    // Sin demora, como una pistola: con 5 ms, en un runner cargado un hueco pasaba los 50 ms del umbral.
    await page.keyboard.type(`/${KNOWN_CODE}`, { delay: 0 });
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

// App Shell (DS-5): foco, título, desborde a 375 px y barra inferior, lo que jsdom no puede responder.
// MainLayout no tiene spec unitario a propósito: subiría la cobertura sin comprobar nada de esto.
test.describe('the App Shell', () => {
  test('the first Tab is the skip link, and it lands the focus on <main>', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // WCAG 2.4.1: sin el enlace, el menú de dieciséis destinos se paga con Tab en cada pantalla.
    await page.keyboard.press('Tab');
    const skip = page.locator('[data-skip-link]');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    // Aterriza en main y no en el título: en el showroom el título va después de la barra lateral
    // y saltaría el buscador. Anunciar dónde estás le toca al cambio de ruta (prueba de abajo).
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('`/` lands in the header search from a screen that did not claim it', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-page-heading]').click();

    await page.keyboard.press('/');

    // La otra mitad de los «cinco Tab hasta el buscador» que reportó DS-2: con esto son cero.
    await expect(page.locator('[data-shell-search] input')).toBeFocused();
  });

  test('a route opens a tab, and Delete closes it onto its neighbour', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav-item="catalogs"]').click();
    await page.locator('[data-nav-item="articles"]').click();
    await expect(page).toHaveTitle(/Art[ií]culos|Articles/);
    await page.locator('[data-nav-item="clients"]').click();
    await page.locator('[data-nav-item="lots"]').click();

    const tabs = page.locator('[data-tab]');
    await expect(tabs).toHaveCount(4);

    // Una SPA no reemplaza el documento: sin la región viva, el lector de pantalla calla al navegar.
    await expect(page.locator('[data-route-announce]')).toHaveText(/Lotes|Lots/);

    await page.locator('[data-tab][aria-selected="true"]').press('Delete');

    await expect(tabs).toHaveCount(3);
    // Queda la vecina y no la primera: cerrar la cuarta y caer en el tablero es un salto que nadie pidió.
    await expect(page.locator('[data-tab][aria-selected="true"]')).toHaveText(/Clientes|Customers/);
    await expect(page.locator('[data-page-heading]')).toBeFocused();
  });

  test('a menu entry with no screen is a PAGE, never a 404, and says nothing to the console', async ({
    page,
  }) => {
    test.setTimeout(UNDER_CONSTRUCTION.length * ROUTE_BUDGET_MS);
    const watch = await watchConsole(page);
    for (const { url, heading } of UNDER_CONSTRUCTION) {
      const response = await page.goto(url);

      expect(response?.status(), `${url} no respondió`).toBeLessThan(400);
      // No sirve main h1: la página anfitriona tiene un segundo main oculto (el aviso de fallo al arrancar).
      // El h1 dice de quién es la pantalla: sin eso, el comodín que lleva al Dashboard pasaría.
      const title = page.locator('[data-page-heading]');
      await expect(title, `${url} no es su pantalla`).toHaveText(heading);
      // WCAG 2.4.2: la pestaña dice la pantalla antes que la marca, y dice la misma que el h1.
      await expect(page, `${url} no tituló la pestaña`).toHaveTitle(
        `${await title.innerText()} · eWMS Advance`,
      );
      await watch.clean(url);
    }
  });

  test('at 375 px the rail becomes the bottom bar, and the header does not scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.locator('ewms-nav-rail')).toHaveCount(0);
    await expect(page.locator('[data-nav-bottom]')).toBeVisible();

    const header = page.locator('[data-app-header]');
    const overflow = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'la cabecera se desborda a 375 px').toBeLessThanOrEqual(0);

    // La hoja atrapa el foco y Escape lo devuelve: innegociable sea cual sea la forma del menú
    // (decisión del usuario 2026-09-19).
    const more = page.locator('[data-nav-bottom-more]');
    await more.click();
    const sheet = page.locator('[data-nav-bottom-sheet]');
    await expect(sheet).toBeVisible();
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(more).toBeFocused();
  });

  test('at 1024 px the open menu is a drawer: it traps the focus, and Escape or the veil give it back', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Entre la barra inferior y 1280 px el menú llega plegado y en el flujo (decisión del usuario, 2026-09-25).
    const drawer = page.locator('[data-nav-drawer]');
    await expect(page.locator('ewms-nav-rail')).toBeVisible();
    await expect(drawer).toHaveCount(0);

    const hamburger = page.locator('[data-rail-toggle] button');
    await hamburger.click();
    await expect(drawer).toBeVisible();
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');

    // Atrapado: ni Tab ni Shift+Tab lo sacan del cajón.
    const inside = (): Promise<boolean> =>
      drawer.evaluate((el) => el.contains(document.activeElement));
    await expect.poll(inside).toBe(true);
    for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      expect(await inside(), `${key} left the drawer`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(hamburger).toBeFocused();

    // El velo cierra igual, por el mismo camino.
    await hamburger.click();
    await expect(drawer).toBeVisible();
    await page.locator('[data-nav-drawer-veil]').click({ position: { x: 700, y: 400 } });
    await expect(drawer).toHaveCount(0);
    await expect(hamburger).toBeFocused();
  });

  test('a favourite is ONE click from anywhere, and is lost on reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav-item="catalogs"]').click();
    await page.locator('[data-nav-item="articles"]').click();
    // La estrella marca la pantalla que se ve: sin esperar la navegación, marcaba el Dashboard.
    await expect(page).toHaveURL(/\/catalogos\/articulos$/);

    await page.locator('[data-app-header] [data-favorite-toggle] button').click();
    const entry = page.locator('ewms-nav-rail [data-favorite]');
    await expect(entry).toHaveCount(1);

    await page.locator('[data-nav-item="dashboard"]').click();
    await expect(page).toHaveURL(/\/$/);
    await entry.click();
    await expect(page).toHaveURL(/\/catalogos\/articulos$/);

    // La limitación se afirma (REQ-FE-DS4-002 v1.2, PACQ-01.5): la lista vive en memoria, sin storage.
    // Cuando se conecten las preferencias del Security Core esta prueba falla: ahí se reescriben los documentos.
    await page.reload();
    await expect(page.locator('ewms-nav-rail [data-favorite]')).toHaveCount(0);
    await expect(page.locator('ewms-nav-rail [data-favorites-empty]')).toBeVisible();
  });
});

// Un escaneo axe del marco (landmarks, salto, menú, pestañas): una violación ahí está en todas las pantallas.
// Las de cada componente se escanean en showroom.
test('the application chrome has no axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'eWMS Advance' })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
