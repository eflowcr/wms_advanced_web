import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * El showroom y las medidas que necesitan navegador: jsdom no maqueta y toda caja le da cero.
 * El banco de captura (playwright.capture.config.ts) no corre acá: capturas sin línea base no afirman nada.
 */

import {
  PAGES,
  BANNER,
  BUTTON,
  CARD,
  CHECKBOX,
  DIALOG,
  INPUT,
  PAGINATION,
  RADIO,
  SELECT,
  SPACING,
  TABLE,
  TEXT,
  TOAST,
  TOGGLE,
  TOOLTIP,
} from './routes';

/** Las fuentes cambian todo ancho medido: nada se mide antes de que carguen. */
async function ready(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      [400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 1rem Montserrat`)),
    );
    await document.fonts.ready;
  });
}

function round(value: number | undefined): number {
  return Math.round((value ?? 0) * 100) / 100;
}

test.describe('the showroom renders and is reachable', () => {
  for (const { url, heading } of PAGES) {
    test(`${url} renders its heading`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    });
  }

  test('the retired routes still work', async ({ page }) => {
    // Las URL se declararon estables: un enlace ya compartido tiene que seguir abriendo.
    for (const [old, now, heading] of [
      ['/design-system/iconografia', /\/foundations\/icons$/, 'Iconografía'],
      ['/design-system/components/icon-button', /\/components\/button$/, 'Botón'],
      ['/design-system/components/search-select', /\/components\/select$/, 'Select'],
    ] as const) {
      await page.goto(old);
      await expect(page).toHaveURL(now);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }
  });

  test('the sidebar marks the page you are on, once even when two entries share it', async ({
    page,
  }) => {
    const current = page.locator('[data-sidebar] a[aria-current="page"]');
    // Tabla y Badge comparten ruta: se marca solo la primera.
    for (const [url, name] of [
      [BUTTON, 'Botón'],
      [TABLE, 'Tabla de datos'],
    ] as const) {
      await page.goto(url);
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(name);
    }
  });

  test('the search filters the catalogue by name and by selector', async ({ page }) => {
    await page.goto('/design-system');
    const search = page.getByLabel('Buscar por nombre o selector');
    const links = page.locator('[data-sidebar] nav li');

    // Esperar antes de contar: count() no reintenta y leerlo a mitad de render arruina lo que sigue.
    await expect(links.first()).toBeVisible();
    const total = await links.count();
    expect(total).toBeGreaterThan(20);

    // Dos desde DS-5, y es la búsqueda funcionando: «Toggle» coincide por nombre y «Favoritos»
    // por su selector ewms-favorite-toggle.
    await search.fill('toggle');
    await expect(links).toHaveCount(2);

    // También se busca por selector: es lo que se escribe en una plantilla.
    await search.fill('ewms-select');
    await expect(links).toHaveCount(1);
    await expect(links.first()).toContainText('Select');

    await search.fill('');
    await expect(links).toHaveCount(total);
  });

  for (const width of [1440, 1280]) {
    test(`no page scrolls sideways at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const { url, heading } of PAGES) {
        await page.goto(url);
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        await ready(page);
        const overflow = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(overflow.scroll, `${url} at ${width}`).toBeLessThanOrEqual(overflow.client);
      }
    });
  }
});

// Favoritos entre shell y catálogo (cierre de DS-5): acá y no en smoke porque todo lo que puede romperlo
// toca design-system/, showroom/ o el layout del shell. Navegador en español: pasar a inglés es lo probado.
test.describe('favourites: one list, and the route as the identity', () => {
  test.use({ locale: 'es-CR' });

  // Una sola lista por app: el showroom proveía EWMS_FAVORITES_STORE otra vez y había dos estrellas
  // sobre dos listas. La provee el shell y el catálogo la inyecta, como EWMS_SHORTCUT_MAP.
  test('a catalogue page has ONE star, and the rail and the sidebar agree', async ({ page }) => {
    const route = '/design-system/components/button';
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Un solo botón de dos estados en la página, y es el de la cabecera.
    const star = page.locator('[aria-pressed]');
    await expect(star).toHaveCount(1);
    await expect(page.locator('[data-app-header] [aria-pressed]')).toHaveCount(1);

    const inRail = page.locator(`ewms-nav-rail [data-favorite="${route}"]`);
    const inSidebar = page.locator(`[data-sidebar] [data-favorite="${route}"]`);

    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(inRail).toHaveCount(1);
    await expect(inSidebar).toHaveCount(1);
    // Cada bloque la nombra a su manera y ninguno muestra la ruta cruda.
    await expect(inSidebar).toHaveText('Botón');
    await expect(inRail).not.toContainText('/design-system');

    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await expect(inRail).toHaveCount(0);
    await expect(inSidebar).toHaveCount(0);
  });

  // Un favorito es una ruta (REQ-FE-DS4-002 v1.3): antes guardaba el nombre ya traducido y quedaba
  // en español en inglés (ADR 0008). Solo cambia el idioma; el nombre se resuelve al dibujar.
  test('a favourite follows the language, in the rail and in the catalogue', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav-item="catalogs"]').click();
    await page.locator('[data-nav-item="articles"]').click();
    await page.locator('[data-app-header] [data-favorite-toggle] button').click();

    const inRail = page.locator('ewms-nav-rail [data-favorite="/catalogos/articulos"]');
    await expect(inRail).toHaveText('Artículos');

    await page.locator('#language-switcher').selectOption('en');
    await expect(inRail).toHaveText('Articles');

    // La barra del catálogo lee la misma lista y le pide el nombre a la app: sigue el idioma
    // aunque el catálogo sea solo en español.
    await page.locator('[data-nav-item="design-system"]').click();
    const inSidebar = page.locator('[data-sidebar] [data-favorite="/catalogos/articulos"]');
    await expect(inSidebar).toHaveText('Articles');

    await page.locator('#language-switcher').selectOption('es');
    await expect(inSidebar).toHaveText('Artículos');
    await expect(inRail).toHaveText('Artículos');
  });
});

// Pendiente desde el PR 1: Loading oculta con visibility y no display para no cambiar la caja
// (medido a mano: 83.23 x 40 en ambos estados, 40 x 40 el icon button).
test.describe('Loading does not change the size of the control', () => {
  test('the button keeps its box, with an icon and without', async ({ page }) => {
    await page.goto(BUTTON);
    await ready(page);

    // Default y Loading conviven solo en la matriz de estados, con el mismo contenido.
    const cells = page.locator('ewms-state-matrix tbody tr').first().locator('td');
    const defaultBox = await cells.nth(0).locator('button').boundingBox();
    const loadingBox = await cells.nth(4).locator('button').boundingBox();

    expect(round(defaultBox?.width), 'width must not change in Loading').toBe(
      round(loadingBox?.width),
    );
    expect(round(defaultBox?.height), 'height must not change in Loading').toBe(
      round(loadingBox?.height),
    );
    expect(round(defaultBox?.height)).toBe(40);

    // Con icono: el botón de la demo se mide contra sí mismo, en su propia transición.
    const submit = page.locator('[data-demo-submit] button');
    const before = await submit.boundingBox();
    await submit.click();
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    const during = await submit.boundingBox();

    expect(round(before?.width), 'width must not change in Loading (with icon)').toBe(
      round(during?.width),
    );
    expect(round(before?.height)).toBe(round(during?.height));
  });

  test('the loading button keeps its name, its focus and refuses a second click', async ({
    page,
  }) => {
    await page.goto(BUTTON);
    await ready(page);

    const submit = page.locator('[data-demo-submit] button');
    const counter = page.locator('[role="status"]', { hasText: 'Envíos registrados' });

    await submit.focus();
    await submit.press('Enter');
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    await expect(submit).toHaveAttribute('aria-disabled', 'true');
    await expect(counter).toHaveText('Envíos registrados: 1');

    // El nombre accesible sobrevive a visibility hidden gracias a aria-labelledby.
    await expect(page.getByRole('button', { name: 'Confirmar recepción' })).toHaveCount(1);
    // El foco no se mueve: por eso aria-disabled y no el atributo nativo, que lo tiraría a body.
    await expect(submit).toBeFocused();

    await submit.click({ force: true });
    await submit.press('Enter');
    await expect(counter).toHaveText('Envíos registrados: 1');
  });

  test('the icon button stays square while loading', async ({ page }) => {
    await page.goto(BUTTON);
    await ready(page);

    // Dos instancias reales, una en reposo y otra cargando: se comparan controles renderizados.
    const idle = page.locator('[data-demo-tooltip] button');
    const loading = page.locator('[data-demo-iconbutton-loading] button');

    const idleBox = await idle.boundingBox();
    const loadingBox = await loading.boundingBox();

    expect(round(idleBox?.width), 'medium icon button is square').toBe(40);
    expect(round(idleBox?.height)).toBe(40);
    expect(round(loadingBox?.width), 'Loading must not change the box').toBe(round(idleBox?.width));
    expect(round(loadingBox?.height)).toBe(round(idleBox?.height));
    await expect(loading).toHaveAttribute('aria-busy', 'true');
  });
});

// Pendiente desde el PR 1: un panel que no cabe se da vuelta. Los disparadores se mueven a cada borde
// desde la prueba: se prueba el overlay, no un layout que alguien fuera a publicar.
test.describe('a panel that does not fit flips instead of falling off', () => {
  const CORNERS = [
    { name: 'top-left', top: '0px', left: '0px' },
    { name: 'top-right', top: '0px', left: 'calc(100vw - 60px)' },
    { name: 'bottom-left', top: 'calc(100vh - 50px)', left: '0px' },
    { name: 'bottom-right', top: 'calc(100vh - 50px)', left: 'calc(100vw - 60px)' },
  ] as const;

  for (const corner of CORNERS) {
    test(`the tooltip stays on screen at ${corner.name}`, async ({ page }) => {
      await page.goto(BUTTON);
      await ready(page);

      const host = page.locator('[data-demo-tooltip]');
      await host.evaluate(
        (el, position) => {
          const style = (el as HTMLElement).style;
          style.position = 'fixed';
          style.zIndex = '1';
          style.top = position.top;
          style.left = position.left;
        },
        { top: corner.top, left: corner.left },
      );

      await host.locator('button').hover();
      // Por id y no por role tooltip: ese rol solo aparece con describes; si el control ya tiene
      // nombre, el panel es decoración aria-hidden.
      const panel = page.locator('[id^="ewms-tooltip-"]');
      await expect(panel).toBeVisible();

      const box = await panel.boundingBox();
      const viewport = page.viewportSize();
      expect(box, corner.name).not.toBeNull();
      expect(box!.x, `${corner.name}: left edge`).toBeGreaterThanOrEqual(0);
      expect(box!.y, `${corner.name}: top edge`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${corner.name}: right edge`).toBeLessThanOrEqual(
        viewport!.width + 1,
      );
      expect(box!.y + box!.height, `${corner.name}: bottom edge`).toBeLessThanOrEqual(
        viewport!.height + 1,
      );
    });
  }

  test('the select panel flips above its trigger near the bottom edge', async ({ page }) => {
    await page.goto(SPACING);
    await ready(page);

    const host = page.locator('[data-demo-select]');
    await host.evaluate((el) => {
      const style = (el as HTMLElement).style;
      style.position = 'fixed';
      style.zIndex = '1';
      style.left = '40px';
      style.top = 'calc(100vh - 70px)';
    });

    const trigger = host.locator('[role="combobox"]').first();
    await trigger.click();

    const panel = page.locator('[role="listbox"]');
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    const triggerBox = await trigger.boundingBox();
    const viewport = page.viewportSize();

    expect(panelBox!.y + panelBox!.height, 'the panel must stay on screen').toBeLessThanOrEqual(
      viewport!.height + 1,
    );
    expect(panelBox!.y, 'the panel must sit above the trigger').toBeLessThan(triggerBox!.y);
  });

  test('the select panel opens below its trigger when there is room', async ({ page }) => {
    await page.goto(SPACING);
    await ready(page);

    const trigger = page.locator('[data-demo-select] [role="combobox"]').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();

    const panel = page.locator('[role="listbox"]');
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    const triggerBox = await trigger.boundingBox();
    expect(round(panelBox!.y)).toBeCloseTo(round(triggerBox!.y + triggerBox!.height), 0);
    // El panel toma el ancho del disparador y la lista también: ver la nota en select.types.ts.
    expect(round(panelBox!.width)).toBeCloseTo(round(triggerBox!.width), 0);
  });
});

// Cada número es algo que afirman tokens.css o una ficha; si falla, uno de los dos miente. Alturas,
// caja 18x18 y riel 44x24 se miden en la ficha de cada componente; acá, solo que tres controles se alinean.
test.describe('the fixed geometry of the system', () => {
  test('a field and a button of the same size share the same box', async ({ page }) => {
    await page.goto(SPACING);
    await ready(page);

    const input = await page.locator('[data-measure="mixed-input"] input').boundingBox();
    const select = await page.locator('[data-measure="mixed-select"] input').boundingBox();
    const button = await page.locator('[data-measure="mixed-button"] button').boundingBox();

    expect(round(input?.height), 'input md').toBe(40);
    expect(round(select?.height), 'select md').toBe(40);
    expect(round(button?.height), 'button md').toBe(40);
    // La regla que protege la fila mixta: se alinean ópticamente.
    expect(round(input?.y)).toBe(round(button?.y));
    expect(round(select?.y)).toBe(round(button?.y));
  });
});

// Cada ficha lee sus números del propio DOM en vez de imprimirlos; acá se comprueba que lea el correcto.
test.describe('the component sheets measure what they claim', () => {
  test('the icon-only button is square at the three sizes', async ({ page }) => {
    await page.goto(BUTTON);
    await ready(page);

    for (const [size, expected] of [
      ['sm', 32],
      ['md', 40],
      ['lg', 48],
    ] as const) {
      const sample = page.locator(`[data-icon-size-sample="${size}"]`);
      const box = await sample.locator('button').boundingBox();
      expect(round(box?.width), `icon-only ${size} width`).toBe(expected);
      expect(round(box?.height), `icon-only ${size} height`).toBe(expected);
      await expect(sample).toContainText(`${expected} × ${expected} px`);
    }
  });

  test('the text page reads back the element each variant really rendered', async ({ page }) => {
    await page.goto(TEXT);
    await ready(page);

    const anatomy = page.locator('[data-block="7-anatomia"] tbody tr');
    await expect(anatomy.filter({ hasText: 'h3' }).first()).toContainText('<h3>');
    await expect(anatomy.filter({ hasText: 'caption' }).first()).toContainText('<span>');
  });

  test('the input page shows a field and a button sharing a height', async ({ page }) => {
    await page.goto(INPUT);
    await ready(page);

    for (const [size, expected] of [
      ['sm', 32],
      ['md', 40],
      ['lg', 48],
    ] as const) {
      const input = await page.locator(`[data-pair="${size}"] input`).boundingBox();
      const button = await page.locator(`[data-pair="${size}"] button`).boundingBox();
      expect(round(input?.height), `input ${size}`).toBe(expected);
      expect(round(button?.height), `button ${size}`).toBe(expected);
    }
    await expect(page.getByText('NO coinciden')).toHaveCount(0);
  });

  test('the select keeps its chevron at 16 in all three sizes', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    for (const size of ['sm', 'md', 'lg'] as const) {
      const chevron = await page
        .locator(`[data-chevron-sample="${size}"] svg`)
        .boundingBox();
      expect(round(chevron?.width), `chevron ${size}`).toBe(16);
    }
    await expect(page.getByText('no son 16')).toHaveCount(0);
  });

  test('the checkbox and the radio read an 18x18 box off the DOM', async ({ page }) => {
    for (const url of [CHECKBOX, RADIO]) {
      await page.goto(url);
      await ready(page);
      const box = await page.locator('[data-measure-box] input').boundingBox();
      expect(round(box?.width), `${url} width`).toBe(18);
      expect(round(box?.height), `${url} height`).toBe(18);

      // Se afirma la declaración, no el valor usado: Chromium redondea un borde de 1.5px a 1px en todo DPR.
      // El componente debe el token; que --border-width-selection pinte 1px está en el informe DS-2 PR 3.
      const declared = await page.locator('[data-measure-box] input').evaluate((el) => ({
        inline: (el as HTMLElement).style.borderWidth,
        token: getComputedStyle(el).getPropertyValue('--border-width-selection').trim(),
      }));
      expect(declared.inline, `${url} border declaration`).toBe('var(--border-width-selection)');
      expect(declared.token, `${url} border token`).toBe('1.5px');
      // Y la página imprime la misma declaración, por la misma razón.
      await expect(page.getByText('var(--border-width-selection)')).toBeVisible();
    }
  });

  test('the toggle reads a 44x24 track with a 20 thumb', async ({ page }) => {
    await page.goto(TOGGLE);
    await ready(page);

    const track = await page.locator('[data-measure-track] input').boundingBox();
    const thumb = await page.locator('[data-measure-track] span[aria-hidden="true"]').boundingBox();
    expect(round(track?.width)).toBe(44);
    expect(round(track?.height)).toBe(24);
    expect(round(thumb?.width)).toBe(20);
    await expect(page.getByText('no coincide')).toHaveCount(0);
  });

  test('the select panel opens on its own page, as wide as its trigger', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    const trigger = page.locator('[data-demo-select] [role="combobox"]').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();

    const panel = page.locator('[role="listbox"]').first();
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    const triggerBox = await trigger.boundingBox();
    expect(round(panelBox!.width)).toBeCloseTo(round(triggerBox!.width), 0);
  });

  test('the tooltip is dismissed by Escape without the focus moving', async ({ page }) => {
    await page.goto(TOOLTIP);
    await ready(page);

    const host = page.locator('[data-demo-tooltip] button');
    await host.focus();
    const panel = page.locator('[id^="ewms-tooltip-"]');
    await expect(panel).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(host).toBeFocused();
  });

  test('the suppression switch on the tooltip page really suppresses', async ({ page }) => {
    await page.goto(TOOLTIP);
    await ready(page);

    const host = page.locator('[data-demo-suppressed] button');
    await host.hover();
    await expect(page.locator('[role="tooltip"]')).toBeVisible();

    await page.getByRole('button', { name: 'Suprimir el tooltip' }).click();
    await page.mouse.move(0, 0);
    await host.hover();
    await expect(page.locator('[role="tooltip"]')).toHaveCount(0);
  });
});

test.describe('accessibility', () => {
  for (const { url, heading } of PAGES) {
    test(`${url} has no axe violations`, async ({ page }) => {
      await page.goto(url);
      // Esperar la página y no solo las fuentes: la ruta es perezosa y axe sobre un documento sin
      // renderizar reporta unas sesenta violaciones que van y vienen con la carga de la máquina.
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await ready(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

/*
 * Recorrido por teclado (criterio de salida de DS-2): axe no dice si Tab llega a todo o dos veces.
 * El conjunto esperado se lee del DOM, porque una lista escrita a mano envejece en silencio;
 * el recorrido debe visitarlo exacto: nada falta, nada repite, nada ajeno.
 */

/** Una parada de Tab observada; kbd es la marca puesta antes en el elemento. */
interface TabStop {
  readonly kbd: string | null;
  readonly tag: string;
  readonly label: string;
  /** El anillo de foco del sistema es un box-shadow. */
  readonly boxShadow: string;
  readonly outlineStyle: string;
  readonly outlineWidth: string;
  /** Falso solo para el marco del App Shell. */
  readonly inShowroom: boolean;
}

interface Stamped {
  /** Marcas de cada elemento visible, habilitado y enfocable. */
  readonly expected: readonly string[];
  /** Legibles, para que el fallo diga qué control faltó. */
  readonly labels: Readonly<Record<string, string>>;
  /** Controles deshabilitados: nunca deben aparecer en el recorrido. */
  readonly disabled: readonly string[];
  /** Radios que no son la parada de su grupo: un grupo es una sola parada y las flechas mueven dentro. */
  readonly roving: readonly string[];
}

/** Una página llena ronda las cuarenta paradas; trescientas significa que el ciclo nunca cerró. */
const MAX_TABS = 300;

/**
 * Tabs hasta el buscador del catálogo: 3 por el enlace de salto (el número de la comanda), 12 desde
 * el body (techo, para que el marco no crezca sin aviso) y 2 desde el inicio del showroom.
 * Ver vault: App-Shell (El skip link, y a dónde lleva).
 */
const TABS_TO_SEARCH_VIA_SKIP_LINK = 3;
const TABS_TO_SEARCH_IN_DOCUMENT = 12;
const TABS_TO_SEARCH_IN_SHOWROOM = 2;

/**
 * Marca con data-kbd cada enfocable y devuelve lo que el recorrido debe visitar. Visible se mide:
 * sin área, display none, visibility hidden o bajo aria-hidden / inert no se alcanza con teclado.
 */
async function stampFocusable(page: Page): Promise<Stamped> {
  return page.evaluate(() => {
    const SELECTOR = [
      'a[href]',
      'area[href]',
      'button',
      'input',
      'select',
      'textarea',
      'summary',
      '[tabindex]',
      '[contenteditable=""]',
      '[contenteditable="true"]',
    ].join(',');

    const visible = (el: Element): boolean => {
      if (el.closest('[aria-hidden="true"], [inert]')) {
        return false;
      }
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const name = (el: Element): string => {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
      const aria = el.getAttribute('aria-label') ?? '';
      const id = el.id ? '#' + el.id : '';
      return (el.tagName.toLowerCase() + id + ' ' + (aria || text)).trim();
    };

    // La parada de cada grupo es el radio marcado, o el primero; se agrupa por form + name, como el navegador.
    const radioTabStop = new Map<string, HTMLInputElement>();
    for (const el of Array.from(document.querySelectorAll('input[type="radio"]'))) {
      const radio = el as HTMLInputElement;
      if (radio.disabled || !radio.name) {
        continue;
      }
      const key = `${radio.form ? radio.form.id || 'form' : 'document'}::${radio.name}`;
      const held = radioTabStop.get(key);
      if (held === undefined || (radio.checked && !held.checked)) {
        radioTabStop.set(key, radio);
      }
    }
    const isTabStopRadio = (el: Element): boolean =>
      Array.from(radioTabStop.values()).includes(el as HTMLInputElement);

    const expected: string[] = [];
    const disabled: string[] = [];
    const roving: string[] = [];
    const labels: Record<string, string> = {};
    let n = 0;

    /** Lo que el navegador pone solo en el orden de Tab. */
    const NATIVELY_FOCUSABLE = ['a', 'area', 'button', 'input', 'select', 'textarea', 'summary'];

    for (const el of Array.from(document.querySelectorAll(SELECTOR))) {
      const tabindex = el.getAttribute('tabindex');
      // Un tabindex negativo en un div es un destino de foco normal; en botón, input o enlace es el
      // defecto que se busca (visible, habilitado e inalcanzable). Se salta solo en los no nativos.
      if (
        tabindex !== null &&
        Number(tabindex) < 0 &&
        !NATIVELY_FOCUSABLE.includes(el.tagName.toLowerCase())
      ) {
        continue;
      }

      // Dentro de un tree o tablist, tabindex -1 es el patrón APG (una parada, flechas adentro); fuera
      // sigue fallando y cada compuesto debe tener exactamente una parada. treegrid no: sus celdas
      // tienen controles propios (35 en la Tabla) y excusaría un botón inalcanzable.
      const composite = el.closest('[role="tree"],[role="tablist"]');
      if (composite !== null && tabindex !== null && Number(tabindex) < 0) {
        roving.push(String(n));
        labels[String(n)] = name(el);
        el.setAttribute('data-kbd', String(n));
        n += 1;
        continue;
      }
      if (el instanceof HTMLInputElement && el.type === 'hidden') {
        continue;
      }
      if (!visible(el)) {
        continue;
      }

      const stamp = String(n++);
      el.setAttribute('data-kbd', stamp);
      labels[stamp] = name(el);

      // El atributo disabled y no aria-disabled: el Button en Loading usa aria-disabled para conservar
      // el foco (ver button.ts), así que sigue debiendo parada.
      const isDisabled =
        (el as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)
          .disabled === true;
      if (isDisabled) {
        disabled.push(stamp);
      } else if (
        el instanceof HTMLInputElement &&
        el.type === 'radio' &&
        el.name &&
        !isTabStopRadio(el)
      ) {
        roving.push(stamp);
      } else {
        expected.push(stamp);
      }
    }

    return { expected, labels, disabled, roving };
  });
}

/** Dónde está el foco ahora, con lo que las aserciones necesitan. */
async function readFocus(page: Page): Promise<TabStop> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) {
      return {
        kbd: null,
        tag: 'BODY',
        label: 'body',
        boxShadow: 'none',
        outlineStyle: 'none',
        outlineWidth: '0px',
        inShowroom: false,
      };
    }
    const style = getComputedStyle(el);
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const id = el.id ? '#' + el.id : '';
    return {
      kbd: el.getAttribute('data-kbd'),
      tag: el.tagName,
      label: (el.tagName.toLowerCase() + id + ' ' + (el.getAttribute('aria-label') ?? text)).trim(),
      boxShadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      // El showroom es dueño del catálogo; el App Shell, del marco (cabecera, riel, pestañas y migas).
      inShowroom: !el.closest(
        '[data-app-header], [data-skip-link], ewms-nav-rail, ewms-nav-bottom, ewms-tabs, ewms-breadcrumbs',
      ),
    };
  });
}

/** Tabula desde el inicio del documento hasta que el foco da la vuelta, y reporta cada parada. */
async function walkTabCycle(page: Page): Promise<readonly TabStop[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    // Desde el inicio del documento, para que el primer Tab caiga en el primer enfocable.
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });

  const stops: TabStop[] = [];
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const stop = await readFocus(page);
    const first = stops[0];
    // El ciclo cerró: el foco volvió al documento o al punto de partida.
    if (stop.tag === 'BODY' || (first !== undefined && stop.kbd === first.kbd)) {
      break;
    }
    stops.push(stop);
  }
  return stops;
}

/** Marcas repetidas, en el orden en que se revisitaron. */
function duplicates(visited: readonly (string | null)[]): readonly string[] {
  const seen = new Set<string>();
  const twice: string[] = [];
  for (const kbd of visited) {
    if (kbd === null) {
      continue;
    }
    if (seen.has(kbd)) {
      twice.push(kbd);
    }
    seen.add(kbd);
  }
  return twice;
}

test.describe('keyboard only', () => {
  for (const { url, heading } of PAGES) {
    test(`${url}: the tab order reaches every control, once`, async ({ page }) => {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await ready(page);

      const { expected, labels, disabled, roving } = await stampFocusable(page);
      const stops = await walkTabCycle(page);

      expect(stops.length, `${url}: the tab cycle never closed`).toBeLessThan(MAX_TABS);

      const visited = stops.map((stop) => stop.kbd);

      // Una parada sin marca es un elemento que no estaba cuando se midió la página.
      expect(
        stops.filter((stop) => stop.kbd === null).map((stop) => stop.label),
        `${url}: focus landed on an unstamped element`,
      ).toEqual([]);

      expect(
        expected.filter((kbd) => !visited.includes(kbd)).map((kbd) => labels[kbd]),
        `${url}: never reached by Tab`,
      ).toEqual([]);

      expect(
        duplicates(visited).map((kbd) => labels[kbd]),
        `${url}: focused twice in one cycle`,
      ).toEqual([]);

      expect(
        disabled.filter((kbd) => visited.includes(kbd)).map((kbd) => labels[kbd]),
        `${url}: disabled control in the tab order`,
      ).toEqual([]);

      // Tampoco un radio que no es la entrada de su grupo.
      expect(
        roving.filter((kbd) => visited.includes(kbd)).map((kbd) => labels[kbd]),
        `${url}: a radio group was split into several tab stops`,
      ).toEqual([]);

      // Cada tree o tablist es exactamente una parada: cero es inalcanzable, dos es el roving tabindex roto.
      const composites = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="tree"],[role="tablist"]'))
          .filter((widget) => (widget as HTMLElement).offsetParent !== null)
          .map((widget) => ({
            name: widget.getAttribute('aria-label') ?? widget.getAttribute('role') ?? '?',
            stops: Array.from(widget.querySelectorAll('[data-kbd]:not([tabindex="-1"])')).length,
          })),
      );
      expect(
        composites.filter((widget) => widget.stops !== 1),
        `${url}: a composite widget is not exactly one tab stop`,
      ).toEqual([]);

      // WCAG 2.4.7: box-shadow (--focus-ring-shadow) o contorno. La grilla de /foundations/icons usa
      // contorno de token en sus setenta celdas para no invadir la vecina como una sombra de 3px.
      // Atrapó un span enfocable sin estilo de foco en la página del tooltip.
      expect(
        stops
          .filter((stop) => {
            const shadow = stop.boxShadow !== 'none' && stop.boxShadow !== '';
            const outline =
              stop.outlineStyle !== 'none' && parseFloat(stop.outlineWidth || '0') > 0;
            return !shadow && !outline;
          })
          .map((stop) => stop.label),
        `${url}: focused with no visible focus indicator`,
      ).toEqual([]);

      // Y el indicador tiene que ser nuestro: outline-style auto es el anillo del navegador y el catálogo
      // no puede caer en él. El marco del App Shell queda fuera de esta regla.
      expect(
        stops
          .filter(
            (stop) =>
              stop.inShowroom &&
              (stop.boxShadow === 'none' || stop.boxShadow === '') &&
              stop.outlineStyle === 'auto',
          )
          .map((stop) => stop.label),
        `${url}: showroom control falling back to the browser's own focus ring`,
      ).toEqual([]);
    });
  }

  // La comanda pide el buscador en tres Tab: el enlace de salto va primero y aterriza en main (no en
  // el h1, que acá queda después del buscador). Ver vault: App-Shell.
  test('the skip link puts the catalogue search three Tab presses away', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await ready(page);

    await stampFocusable(page);

    // Un Tab desde el inicio del documento: el enlace de salto y nada antes.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
      document.body.removeAttribute('tabindex');
    });
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-skip-link]')).toBeFocused();

    await page.keyboard.press('Enter');
    let presses = 1;
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      presses += 1;
      const isSearch = await page.evaluate(() => document.activeElement?.id === 'showroom-search');
      if (isSearch) {
        break;
      }
    }

    await expect(page.locator('#showroom-search')).toBeFocused();
    expect(
      presses,
      'Tab presses from the top of the document via the skip link',
    ).toBeLessThanOrEqual(TABS_TO_SEARCH_VIA_SKIP_LINK);
  });

  // El tercer número de App-Shell.md (12 desde el body, 3 por el salto, 0 con el atajo). La barra lleva
  // al buscador de la cabecera: el catálogo no reclama el atajo y lo responde el shell.
  test('`/` reaches a search with no Tab at all', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await ready(page);
    await page.getByRole('heading', { level: 1 }).first().click();

    await page.keyboard.press('/');

    await expect(page.locator('[data-shell-search]')).toBeFocused();
  });

  // El buscador va encima de los enlaces del catálogo para que la barra lateral no sea un muro.
  test('the sidebar is not a wall in front of the catalogue search', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await ready(page);

    await stampFocusable(page);
    const stops = await walkTabCycle(page);
    const chain = stops.map((stop) => stop.label).join(' -> ');
    const index = stops.findIndex((stop) => stop.label.includes('#showroom-search'));

    expect(index, `the search was never reached by Tab. Order: ${chain}`).toBeGreaterThanOrEqual(0);

    // Desde el inicio del documento, con todo el App Shell: es techo, no meta.
    expect(
      index + 1,
      `tabs to the search: ${stops
        .slice(0, index + 1)
        .map((stop) => stop.label)
        .join(' -> ')}`,
    ).toBeLessThanOrEqual(TABS_TO_SEARCH_IN_DOCUMENT);

    // Desde la primera parada del showroom: la parte de la que trata la regla.
    const firstInShowroom = stops.findIndex((stop) => stop.inShowroom);
    expect(firstInShowroom, `no showroom stop at all. Order: ${chain}`).toBeGreaterThanOrEqual(0);
    expect(
      index - firstInShowroom + 1,
      `tabs from the first showroom stop to the search, within: ${chain}`,
    ).toBeLessThanOrEqual(TABS_TO_SEARCH_IN_SHOWROOM);

    // Los enlaces del catálogo van detrás, así el número no crece con el catálogo.
    const firstCatalogueLink = stops.findIndex(
      (stop) =>
        stop.label.startsWith('a ') && stop.inShowroom && !stop.label.includes('Sistema de diseño'),
    );
    expect(firstCatalogueLink, `no catalogue link found. Order: ${chain}`).toBeGreaterThan(index);
  });

  test('Space ticks a checkbox, and the header reads the group back', async ({ page }) => {
    await page.goto(CHECKBOX);
    await ready(page);

    const rows = page.locator('[data-demo-checklist] li input[type="checkbox"]');
    const first = rows.first();
    await first.focus();
    await expect(first).not.toBeChecked();

    await page.keyboard.press('Space');
    await expect(first).toBeChecked();
    // La casilla «seleccionar todo» depende del grupo: el teclado la deja mixta igual que un clic.
    await expect(page.locator('[data-demo-checklist] [role="status"]')).toContainText(
      'indeterminado true',
    );

    await page.keyboard.press('Space');
    await expect(first).not.toBeChecked();
  });

  test('the arrows move a radio group, and Tab treats it as one stop', async ({ page }) => {
    await page.goto(RADIO);
    await ready(page);

    const radios = page.locator('[data-demo-group] input[type="radio"]');
    const value = page.locator('[data-demo-value]');
    const before = await value.textContent();

    await radios.first().focus();
    await page.keyboard.press('ArrowDown');

    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(1)).toBeFocused();
    await expect(value).not.toHaveText(before ?? '');

    await page.keyboard.press('ArrowUp');
    await expect(radios.first()).toBeChecked();
    await expect(radios.first()).toBeFocused();
  });

  test('Space flips a toggle and the change applies on the spot', async ({ page }) => {
    await page.goto(TOGGLE);
    await ready(page);

    const first = page.locator('[data-demo-preferences] input[role="switch"]').first();
    const applied = page.locator('[data-demo-preferences] [role="status"]');
    const before = Number((await applied.textContent())?.match(/\d+/)?.[0] ?? 0);

    await first.focus();
    const wasOn = await first.isChecked();
    await page.keyboard.press('Space');

    await expect(first).toBeChecked({ checked: !wasOn });
    await expect(applied).toContainText(String(before + 1));
  });

  test('the select opens, walks and chooses without a mouse, and Escape gives the focus back', async ({
    page,
  }) => {
    await page.goto(SELECT);
    await ready(page);

    const trigger = page.locator('[data-demo-select] [role="combobox"]').first();
    const panel = page.locator('[role="listbox"]');
    const value = page.locator('[data-demo-value]');

    // Tres estados, con teclado: flecha abre, flecha elige, Enter confirma.
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[role="option"]')).toHaveCount(3);

    // Escape cierra sin elegir y el foco nunca dejó el campo (aria-activedescendant, ver select.ts).
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(value).toHaveText('preparacion');

    await page.keyboard.press('ArrowDown');
    await expect(panel).toBeVisible();
    // Abre sobre el valor: la activa es «En preparación», la segunda.
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-option-1$/);
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-option-2$/);
    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(value).toHaveText('despachada');
  });

  test('Escape dismisses a tooltip opened by focus, and the focus stays put', async ({ page }) => {
    await page.goto(TOOLTIP);
    await ready(page);

    const host = page.locator('[data-demo-tooltip] button');
    await host.focus();
    const panel = page.locator('[id^="ewms-tooltip-"]');
    await expect(panel).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(host).toBeFocused();
  });

  // Enter en un botón y el botón ocupado que rechaza la segunda pulsación se prueban junto al
  // estado Loading, arriba.
});

// DS-3 lote A: icono que no crece con la severidad, acento de 4 px y grupo de cards en una parada.
// Se leen de la página renderizada, que muestra los mismos números.
test.describe('DS-3 lote A: notificaciones y card', () => {
  test('the banner keeps its icon at 18 px in all four variants', async ({ page }) => {
    await page.goto(BANNER);
    await ready(page);

    for (const variant of ['success', 'warning', 'danger', 'info'] as const) {
      const icon = await page.locator(`[data-icon-sample="${variant}"] svg`).boundingBox();
      expect(round(icon?.width), `banner ${variant} icon width`).toBe(18);
      expect(round(icon?.height), `banner ${variant} icon height`).toBe(18);
    }
    await expect(page.getByText('no son 18 px')).toHaveCount(0);
  });

  test('the banner does not remove itself when it is dismissed', async ({ page }) => {
    await page.goto(BANNER);
    await ready(page);

    const banner = page.locator('[data-demo-banner] ewms-banner');
    await expect(banner).toBeVisible();

    await page.locator('[data-demo-banner] button').click();

    await expect(page.locator('[data-dismiss-count]')).toHaveText('1');
    // Sigue ahí: quitarlo lo decide quien lo usa.
    await expect(banner).toBeVisible();
  });

  test('a toast comes up in the shell outlet, with a 4 px accent, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(TOAST);
    await ready(page);

    const stack = page.locator('[role="status"][aria-live="polite"]');
    // Una sola región viva en todo el documento, aun vacía.
    await expect(stack).toHaveCount(1);

    await page.locator('[data-raise-sticky] button').click();

    const toast = stack.locator('> div');
    await expect(toast).toHaveCount(1);

    const accent = await toast.locator('> span').boundingBox();
    expect(round(accent?.width), 'toast accent width').toBe(4);
    await expect(page.locator('[data-accent-width]')).toHaveText('4 px');

    // Con duración 0 no vence solo: Escape cierra el más reciente.
    await page.keyboard.press('Escape');
    await expect(toast).toHaveCount(0);
  });

  test('a toast with the default duration goes away on its own', async ({ page }) => {
    await page.goto(TOAST);
    await ready(page);

    await page.locator('[data-raise="success"] button').click();
    const toast = page.locator('[role="status"][aria-live="polite"] > div');
    await expect(toast).toHaveCount(1);

    // --duration-toast es 3000 ms, con margen: lo que importa es que el servicio leyó el token.
    await expect(toast).toHaveCount(0, { timeout: 6000 });
  });

  test('the card group is one tab stop, and the arrows choose inside it', async ({ page }) => {
    await page.goto(CARD);
    await ready(page);

    const cards = page.locator('[data-demo-warehouses] [role="radio"]');
    await expect(cards).toHaveCount(4);
    await expect(page.locator('[data-tab-stops]')).toHaveText('1');

    // Se entra al grupo por la card elegida, que el formulario siembra con Central.
    await cards.nth(1).focus();
    await expect(cards.nth(1)).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('ArrowDown');
    await expect(cards.nth(2)).toHaveAttribute('aria-checked', 'true');
    await expect(cards.nth(2)).toBeFocused();
    await expect(page.locator('[data-demo-value]')).toHaveText('devoluciones');

    // Sur no está disponible: las flechas la saltan y dan la vuelta a Norte, como un grupo de radios.
    await page.keyboard.press('ArrowDown');
    await expect(cards.nth(0)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('[data-demo-value]')).toHaveText('norte');
  });

  test('the chosen card is marked three ways, none of them only colour', async ({ page }) => {
    await page.goto(CARD);
    await ready(page);

    const chosen = page.locator('[data-demo-warehouses] [role="radio"][aria-checked="true"]');
    await expect(chosen).toHaveCount(1);

    const marks = await chosen.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderTopColor,
        check: element.querySelectorAll('svg').length,
      };
    });

    // Relleno y borde de distinto color, y hay un glifo.
    expect(marks.background).not.toBe(marks.border);
    expect(marks.check).toBeGreaterThan(0);
  });
});

// DS-3 lote B: trampa de foco, fondo y escaneo más rápido que una persona, que jsdom solo aproxima.
test.describe('DS-3 lote B: dialog', () => {
  test('opens, traps the focus, and gives it back to whoever opened it', async ({ page }) => {
    await page.goto(DIALOG);
    await ready(page);

    const opener = page.locator('[data-open="info"] button');
    await opener.focus();
    await opener.press('Enter');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // El foco cae en Cancelar: va primero en el DOM para que el teclado llegue a la respuesta segura.
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();

    // Es una trampa de verdad: tabular entre los dos botones nunca sale.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Publicar' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('names and describes itself with its own title and body', async ({ page }) => {
    await page.goto(DIALOG);
    await ready(page);
    await page.locator('[data-open="danger"] button').click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // El nombre y la descripción accesibles se calculan de aria-labelledby y aria-describedby.
    await expect(dialog).toHaveAccessibleName(/Eliminar la expedición/);
    await expect(dialog).toHaveAccessibleDescription(/34 bultos/);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('the backdrop does not close a destructive dialog, and does close an informative one', async ({
    page,
  }) => {
    await page.goto(DIALOG);
    await ready(page);

    await page.locator('[data-open="danger"] button').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.locator('.cdk-overlay-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.locator('[data-open="info"] button').click();
    await expect(dialog).toBeVisible();
    await page.locator('.cdk-overlay-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-last-answer]')).toContainText('no confirmado');
  });

  test('each tone is a glyph with no shadow, on the left margin of the form dialog', async ({
    page,
  }) => {
    await page.goto(DIALOG);
    await ready(page);

    for (const tone of ['danger', 'warning', 'info'] as const) {
      await page.locator(`[data-open="${tone}"] button`).click();
      const dialog = page.locator('[role="dialog"]');
      const glyph = dialog.locator('[data-dialog-icon]');
      await expect(glyph.locator('svg')).toHaveCount(1);
      expect(await glyph.evaluate((element) => getComputedStyle(element).boxShadow)).toBe('none');

      // Como el de formulario (p-6 y borde): todo arranca en el borde interior del relleno.
      const container = dialog.locator('div').first();
      const box = await container.boundingBox();
      const inset = await container.evaluate((element) => {
        const style = getComputedStyle(element);
        return parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
      });
      for (const part of [glyph, dialog.locator('p').first()]) {
        const left = (await part.boundingBox())!.x - box!.x;
        expect(round(left), `${tone} left margin`).toBe(round(inset));
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
  });

  test('the backdrop is blurred navy, from the tokens', async ({ page }) => {
    await page.goto(DIALOG);
    await ready(page);
    await page.locator('[data-open="info"] button').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const backdrop = await page.locator('.cdk-overlay-backdrop').evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, filter: style.backdropFilter };
    });

    // Azul marino al 50 % y no negro: el overlay tiñe la escena con la marca.
    expect(backdrop.background).toBe('rgba(1, 15, 66, 0.5)');
    expect(backdrop.filter).toContain('blur');
  });
});

test.describe('DS-3 lote B: el select con una fuente remota', () => {
  const FIELD = '[data-demo-search] input[role="combobox"]';

  test('filters as you type, with nothing opened first', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    await expect(page.locator('[role="listbox"]')).toHaveCount(0);

    await page.locator(FIELD).fill('caja');
    await expect(page.locator('[role="listbox"]')).toBeVisible();
    await expect(page.locator('[role="listbox"] [role="option"]').first()).toBeVisible();
  });

  test('a scan resolves without the panel ever opening', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    const field = page.locator(FIELD);
    await field.focus();

    // Sin demora: una pistola, no una persona (umbral 50 ms, humano ~120; REQ-FE-DS3-001). Con 5 ms,
    // en un runner cargado un hueco pasó los 50 ms, la ráfaga se leyó como tecleo y la prueba fallaba
    // solo en la suite completa.
    await page.keyboard.type('SKU-88042', { delay: 0 });
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-demo-search-value]')).toContainText('SKU-88042');
    // Cero clics, y el panel nunca apareció.
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  });

  test('typing the same code at human speed opens the panel instead', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    const field = page.locator(FIELD);
    await field.focus();
    await page.keyboard.type('SKU-88042', { delay: 150 });

    await expect(page.locator('[role="listbox"]')).toBeVisible();
    await expect(page.locator('[data-demo-search-value]')).toHaveText('(ninguno)');
  });

  test('the error is in the flow, and one Tab from the field reaches its retry', async ({
    page,
  }) => {
    await page.goto(SELECT);
    await ready(page);

    await page.locator('[data-behaviour="failing"] button').click();
    await page.locator(FIELD).fill('caja');

    const alert = page.locator('[data-demo-search] [role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('No se pudo consultar');

    // Donde iría «sin resultados» no hay nada: son estados distintos y en lugares distintos.
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);

    await page.locator(FIELD).focus();
    await page.keyboard.press('Tab');
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeFocused();
  });

  test('a source slower than the timeout is an error, not an empty warehouse', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    await page.locator('[data-behaviour="slow"] button').click();
    await page.locator(FIELD).fill('caja');

    const alert = page.locator('[data-demo-search] [role="alert"]');
    await expect(alert).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-demo-search]')).not.toContainText('Sin resultados');
  });

  test('pages: the next page is appended, and changing the text starts over', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    await page.locator(FIELD).fill('SKU');
    const options = page.locator('[role="listbox"] [role="option"]');
    // Veinte resultados más la fila «cargar más».
    await expect(options).toHaveCount(21);

    await options.last().click();
    await expect(options).toHaveCount(41);

    await page.locator(FIELD).fill('SKU-88042');
    await expect(options).toHaveCount(1);
  });

  test('works when the source declines to count', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    await page.locator('[data-toggle-counts] button').click();
    await expect(page.locator('[data-counts-value]')).toContainText('total: null');

    await page.locator(FIELD).fill('SKU');
    await expect(page.locator('[role="listbox"] [role="option"]')).toHaveCount(21);
    // La región viva dice lo que puede, sin total.
    await expect(page.locator('[data-demo-search] [role="status"]')).toContainText('20 resultados');
  });

  test('the arrows walk the list and Escape gives nothing away', async ({ page }) => {
    await page.goto(SELECT);
    await ready(page);

    const field = page.locator(FIELD);
    await field.fill('caja');
    // El panel abre cuando empieza la consulta, no cuando responde (RFE-01): hay que esperar una fila.
    await expect(page.locator('[role="listbox"] [role="option"]').first()).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-activedescendant', /-option-0$/);
    await page.keyboard.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-activedescendant', /-option-1$/);

    await page.keyboard.press('Escape');
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
    await expect(page.locator('[data-demo-search-value]')).toHaveText('(ninguno)');
    await expect(field).toBeFocused();

    // Enter sobre una fila activa elige el registro, no el texto.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-demo-search-value]')).toContainText('SKU-');
  });
});

// DS-3 lote C: geometría, teclado real y cuántas líneas escribe el consumidor, contra lo que se diseñó la API.
test.describe('DS-3 lote C: la tabla', () => {
  const DEMO = '[data-demo-table]';
  const ROWS = `${DEMO} tbody tr:not([data-empty-row])`;

  test('THE CONSUMER TEMPLATE IS UNDER THE CEILING, and the count is the snippet own', async ({
    page,
  }) => {
    await page.goto(TABLE);
    await ready(page);

    const printed = Number(await page.locator('[data-template-lines]').innerText());
    const snippet = await page.locator('[data-consumer-template]').innerText();

    expect(printed).toBe(snippet.trimEnd().split('\n').length);
    // El techo de la comanda para la demo de expediciones: si falla, se corrige la API, no la página.
    expect(printed).toBeLessThanOrEqual(40);
    await expect(page.locator('[data-component-lines]')).toHaveText('4');
  });

  test('a row is exactly as tall as an input of the same size', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    const row = await page.locator(ROWS).first().boundingBox();
    // El campo Medium de la ficha del Input: mismo token, una celda tiene que contenerlo sin crecer.
    await page.goto(INPUT);
    await ready(page);
    const input = await page.locator('[data-pair="md"] input').boundingBox();

    expect(round(row?.height)).toBe(40);
    expect(round(input?.height)).toBe(40);
  });

  test('the compact density really is the other token', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    // La densidad es de la barra de la tabla: un panel con dos opciones.
    await page.locator(`${DEMO} [data-density-menu] button`).click();
    await page.locator('[data-density="sm"]').click();
    await expect(page.locator('[data-density="sm"] input')).toBeChecked();

    const row = await page.locator(ROWS).first().boundingBox();
    expect(round(row?.height)).toBe(32);
  });

  test('expands three levels into ONE table', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await expect(page.locator(ROWS)).toHaveCount(12);
    await expect(page.locator(`${ROWS}[aria-level="2"]`)).toHaveCount(0);

    await page.locator(`${DEMO} [data-toggle="0"]`).click();
    // Aserciones con reintento: un count() suelto lee el instante, y así falló una vez la de abajo.
    await expect(page.locator(`${ROWS}[aria-level="2"]`).first()).toBeVisible();

    // La primera línea de esa cabecera, abierta a su vez.
    await page.locator(`${DEMO} [data-toggle="1"]`).click();
    await expect(page.locator(`${ROWS}[aria-level="3"]`).first()).toBeVisible();

    // Tres niveles y una sola tabla: nada anidado.
    await expect(page.locator(`${DEMO} table`)).toHaveCount(1);
  });

  test('EVERY LEVEL IS SET IN FROM THE ONE ABOVE IT', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DEMO} [data-toggle="0"]`).click();
    await expect(page.locator(`${ROWS}[aria-level="2"]`).first()).toBeVisible();

    const label = (level: string) =>
      page
        .locator(`${ROWS}[aria-level="${level}"]`)
        .first()
        .locator('td')
        .nth(1)
        .locator('.truncate');

    const parent = await label('1').boundingBox();
    const child = await label('2').boundingBox();

    // La sangría es un token por nivel y fue cero un tiempo, sin que nada fallara: el árbol se anunciaba
    // bien y se veía plano. Ver vault: Tabla (9. Sangría y anchos).
    const parentSpacer = page
      .locator(`${ROWS}[aria-level="1"]`)
      .first()
      .locator('.tree-toggle-spacer')
      .first();
    const childSpacer = page
      .locator(`${ROWS}[aria-level="2"]`)
      .first()
      .locator('.tree-toggle-spacer')
      .first();

    expect(round((await parentSpacer.boundingBox())?.width)).toBe(0);
    expect(round((await childSpacer.boundingBox())?.width)).toBe(20);

    // Y se ve: el texto del hijo empieza una sangría a la derecha del padre.
    expect(round((child?.x ?? 0) - (parent?.x ?? 0))).toBe(20);
  });

  test('walks the tree with the arrows alone', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    // Una sola parada para la tabla: se enfoca la primera celda, como tras un Tab.
    await page.locator(`${DEMO} [data-cell="0-0"]`).focus();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator(`${ROWS}[aria-level="2"]`).first()).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(page.locator(`${DEMO} [data-cell="1-0"]`)).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    // Primera celda de una fila hija: sube al padre en vez de ir al costado.
    await expect(page.locator(`${DEMO} [data-cell="0-0"]`)).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator(`${ROWS}[aria-level="2"]`)).toHaveCount(0);
  });

  test('Space ticks a row and Enter activates it, with no mouse', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DEMO} [data-cell="1-0"]`).focus();
    await page.keyboard.press(' ');
    await expect(page.locator('[data-selection-count]')).toHaveText('1');

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-activated]')).toContainText('cabecera');
  });

  test('sorts by the raw number, not by the formatted text', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DEMO} [data-sort="bultos"]`).click();
    await expect(page.locator('[data-query]')).toContainText('bultos asc');

    const values = await page
      .locator(`${ROWS} td:nth-child(5)`)
      .evaluateAll((cells) =>
        cells.map((cell) => Number((cell.textContent ?? '').replace(/\D/g, ''))),
      );

    // Ascendente como número: ordenar el texto localizado pone 1.200 antes que 900.
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  test('filters a number range with two boxes, and an empty box is unbounded', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    // Ocultos por defecto: se abren con «Filtros».
    await page.locator(`${DEMO} [data-filters-toggle] button`).click();
    const boxes = page.locator(`${DEMO} [data-filter="bultos"] input`);
    await expect(boxes).toHaveCount(2);

    await boxes.nth(0).fill('100');
    await expect(page.locator('[data-query]')).toContainText('bultos');
    const withMin = await page.locator(ROWS).count();
    expect(withMin).toBeLessThan(12);

    await boxes.nth(0).fill('');
    await expect(page.locator(ROWS)).toHaveCount(12);
  });

  test('the filters hide and come back with the button and Alt+R, and the chips never hide', async ({
    page,
  }) => {
    await page.goto(TABLE);
    await ready(page);

    const toggle = page.locator(`${DEMO} [data-filters-toggle] button`);
    const filterRow = page.locator(`${DEMO} [data-filter-row]`);
    await expect(filterRow).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await page.locator(`${DEMO} [data-filter="codigo"] input`).fill('0403');
    await expect(toggle).toHaveText(/Filtros \(1\)/);

    // Con el foco en la tabla, el atajo del mapa oculta la fila; el chip sigue diciendo qué filtra.
    await page.locator(`${DEMO} [data-cell="0-0"]`).focus();
    await page.keyboard.press('Alt+r');
    await expect(filterRow).toBeHidden();
    await expect(page.locator(`${DEMO} [data-chip="codigo"]`)).toContainText('Código: 0403');
    await expect(page.locator(ROWS)).toHaveCount(1);

    await page.locator(`${DEMO} [data-clear-filters]`).click();
    await expect(page.locator(ROWS)).toHaveCount(12);
    await expect(page.locator(`${DEMO} [data-chip]`)).toHaveCount(0);
  });

  test('the Estado filter is a set: «Con incidencia» plus «En proceso», and nothing else', async ({
    page,
  }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DEMO} [data-filters-toggle] button`).click();
    const trigger = page.locator(`${DEMO} [data-filter="estado"] button`);
    await trigger.click();
    const panel = page.getByRole('dialog', { name: 'Estado' });
    await expect(panel).toBeVisible();

    // Todas marcadas al abrir: se desmarca lo que sobra, con teclado incluido.
    await panel.getByRole('checkbox', { name: 'Pendiente' }).uncheck();
    await panel.getByRole('checkbox', { name: 'Completada' }).press('Space');
    await expect(panel.getByRole('checkbox', { name: 'Todos' })).toHaveAttribute('aria-checked', 'mixed');
    await expect(trigger).toHaveText(/Estado: 2 de 4/);

    const badges = page.locator(`${ROWS} ewms-badge`);
    for (const text of await badges.allTextContents()) {
      expect(text).toMatch(/Con incidencia|En proceso/);
    }
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.locator(`${DEMO} [data-chip="estado"]`)).toContainText('Con incidencia');
  });

  test('columns: the pinned stay in view while the table scrolls, and resize from the keyboard', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(TABLE);
    await ready(page);

    // Con los filtros abiertos la tabla es más ancha que su caja: desplaza adentro, la página no.
    await page.locator(`${DEMO} [data-filters-toggle] button`).click();
    const box = page.locator(`${DEMO} [data-scroll-box]`);
    await box.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    const boxLeft = (await box.boundingBox())!.x;
    const codigo = page.locator(`${DEMO} th[data-col="codigo"]`);
    const select = page.locator(`${DEMO} th[data-col-select]`);
    await expect
      .poll(async () => Math.round((await select.boundingBox())!.x - boxLeft))
      .toBeLessThanOrEqual(1);
    const selectBox = (await select.boundingBox())!;
    expect(Math.round((await codigo.boundingBox())!.x)).toBe(
      Math.round(selectBox.x + selectBox.width),
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    // El separador es una parada de teclado y anuncia su ancho.
    const handle = page.locator(`${DEMO} [data-resize="cliente"]`);
    await handle.focus();
    // Sin getAttribute (no reintenta): el ancho de partida es el de la cabecera medida.
    const before = Math.round((await page.locator(`${DEMO} th[data-col="cliente"]`).boundingBox())!.width);
    await expect(handle).toHaveAttribute('aria-valuenow', String(before));
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', String(before + 16));

    // El selector oculta una columna y la tabla se lo cuenta a quien escucha.
    await page.locator(`${DEMO} [data-column-chooser] button`).click();
    await page.getByRole('dialog', { name: 'Columnas' }).getByRole('checkbox', { name: 'Fecha' }).uncheck();
    await expect(page.locator(`${DEMO} th[data-col="fecha"]`)).toHaveCount(0);
  });

  test('selection with intent: Shift marks a range, the bar acts on it, Ctrl+C pastes into Excel', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(TABLE);
    await ready(page);

    const boxes = page.locator(`${ROWS} input[type="checkbox"]`);
    await boxes.nth(0).click();
    await boxes.nth(3).click({ modifiers: ['Shift'] });
    await expect(page.locator(`${DEMO} [data-selected-count]`)).toHaveText('4 seleccionadas');
    await expect(page.locator(`${DEMO} [data-table-announce]`)).toHaveText('4 seleccionadas');

    await page.locator(`${DEMO} [data-bulk-action="imprimir"] button`).click();
    await expect(page.locator('[data-bulk-choice]')).toHaveText('Imprimir etiquetas · 4 expediciones');

    await page.locator(`${DEMO} [data-cell="0-1"]`).focus();
    await page.keyboard.press('Control+c');
    await expect(page.locator(`${DEMO} [data-table-announce]`)).toHaveText('4 filas copiadas');
    const pasted = await page.evaluate(() => navigator.clipboard.readText());
    // Chromium en Windows devuelve CRLF, que es lo que espera Excel.
    const lines = pasted.split(/\r?\n/);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('Código\tCliente / artículo\tFecha\tBultos\tEstado');
    // Número sin separador y fecha ISO: Excel los lee como dato, no como texto.
    expect(lines[1]).toMatch(/^EXP-2026-0400\t.+\t\d{4}-\d{2}-\d{2}\t\d+\t/);

    await page.locator(`${DEMO} [data-clear-selection] button`).click();
    await expect(page.locator(`${DEMO} [data-bulk-bar]`)).toHaveCount(0);
  });

  test('the status bar counts the rows and adds up Bultos: on screen, then over the selection', async ({
    page,
  }) => {
    await page.goto(TABLE);
    await ready(page);

    const status = page.locator(`${DEMO} [data-table-status]`);
    await expect(status.locator('[data-status-rows]')).toHaveText('12 de 12 filas');
    const bultos = page.locator(`${ROWS} td:nth-child(5)`);
    const numbers = (await bultos.allTextContents()).map((text) => Number(text.replace(/\D/g, '')));
    const onScreen = numbers.reduce((total, value) => total + value, 0);
    await expect(status.locator('[data-aggregate="bultos"]')).toHaveText(
      `Bultos en pantalla: ${new Intl.NumberFormat('es').format(onScreen)}`,
    );

    const boxes = page.locator(`${ROWS} input[type="checkbox"]`);
    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await expect(status.locator('[data-status-selected]')).toHaveText('2 seleccionadas');
    await expect(status.locator('[data-aggregate="bultos"]')).toHaveText(
      `Bultos seleccionados: ${new Intl.NumberFormat('es').format(numbers[0]! + numbers[1]!)}`,
    );
  });

  test('export: a real CSV download, with a BOM, the filtered rows and Excel-readable values', async ({
    page,
  }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DEMO} [data-quick-filter] input`).fill('Andes');
    await expect(page.locator(`${DEMO} [data-status-rows]`)).not.toHaveText('12 de 12 filas');
    const shown = await page.locator(ROWS).count();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator(`${DEMO} [data-export] button`).first().click(),
    ]);
    expect(download.suggestedFilename()).toBe('Expediciones.csv');
    const bytes = await (await download.createReadStream()).toArray();
    const buffer = Buffer.concat(bytes);
    // Con BOM UTF-8: sin él Excel abre «CÃ³digo».
    expect([...buffer.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = buffer.subarray(3).toString('utf-8').split('\r\n');
    expect(lines[0]).toBe('Código,Cliente / artículo,Fecha,Bultos,Estado');
    expect(lines).toHaveLength(shown + 1);
    for (const line of lines.slice(1)) {
      expect(line).toMatch(/^EXP-2026-\d{4},Distribuidora Andes,\d{4}-\d{2}-\d{2},\d+,/);
    }
  });

  test('the quick filter narrows the table, and the empty state is the projected one', async ({
    page,
  }) => {
    await page.goto(TABLE);
    await ready(page);

    const search = page.locator(`${DEMO} [data-quick-filter] input`);
    await search.fill('EXP-2026-0400');
    await expect(page.locator(ROWS)).toHaveCount(1);

    await search.fill('no-existe-nada');
    await expect(page.locator(ROWS)).toHaveCount(0);
    await expect(page.locator(`${DEMO} [data-empty-row]`)).toContainText(
      'Ninguna expedición coincide',
    );
  });

  test('selects every visible row from the header, and says so as mixed in between', async ({
    page,
  }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DEMO} tbody input[type="checkbox"]`).first().check();
    await expect(page.locator('[data-selection-count]')).toHaveText('1');
    await expect(page.locator(`${DEMO} thead input[type="checkbox"]`)).toHaveAttribute(
      'aria-checked',
      'mixed',
    );

    await page.locator(`${DEMO} thead input[type="checkbox"]`).check();
    await expect(page.locator('[data-selection-count]')).toHaveText('12');
  });

  test('a coloured row also says its state in words', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    // toHaveCount y no count(): el primero reintenta hasta que la tabla renderiza; el segundo lee
    // el instante, que en una ruta perezosa es nada. Costó una prueba roja.
    await expect(page.locator(`${DEMO} ewms-badge`)).toHaveCount(12);

    // Cada fila teñida lleva insignia con icono y texto: el color nunca es la única señal (WCAG 1.4.1).
    const tinted = page.locator(`${ROWS}.bg-danger-surface`).first();
    await expect(tinted.locator('ewms-badge')).toContainText('Con incidencia');
    await expect(tinted.locator('ewms-badge svg')).toBeVisible();
  });
});

test.describe('DS-3 lote D: detalle, menú, ventana y paginador', () => {
  const DETALLE = '[data-demo-detalle]';
  const VIRTUAL = '[data-demo-virtual]';
  const PAGINADA = '[data-demo-paginada]';

  test('a master row unfolds a PANEL, and the tree unfolds ROWS', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DETALLE} [data-detail-toggle="0"] button`).click();
    const panel = page.locator(`${DETALLE} [data-detail="0"]`);
    await expect(panel).toBeVisible();

    // Una celda a todo el ancho, con contenido propio del consumidor.
    await expect(panel.locator('td')).toHaveCount(1);
    await expect(panel).toContainText('Bultos totales');

    // La tabla no creció: el panel es una fila del DOM, no una expedición, y no se anuncia como tal.
    await expect(page.locator(`${DETALLE} table`)).toHaveAttribute('aria-rowcount', '12');
  });

  test('the toggle says on the BUTTON what it opened', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    const button = page.locator(`${DETALLE} [data-detail-toggle="0"] button`);
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    // Lo que nombra aria-controls es la celda del panel de la fila 0.
    await expect
      .poll(() =>
        button.evaluate(
          (element) =>
            document
              .getElementById(element.getAttribute('aria-controls') ?? '')
              ?.closest('[data-detail="0"]') != null,
        ),
      )
      .toBe(true);
  });

  test('the row menu opens from the kebab and from the right button', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DETALLE} [data-kebab="0"] button`).click();
    await expect(page.locator('[role="menu"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="menu"]')).toHaveCount(0);

    // El kebab existe porque trackpad y teléfono no tienen botón derecho; quien lo tiene espera que ande.
    await page.locator(`${DETALLE} [data-row="1"]`).click({ button: 'right' });
    await expect(page.locator('[role="menu"]')).toBeVisible();
  });

  test('the menu opens with Shift+F10 and gives the focus back on Escape', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DETALLE} [data-cell="0-0"]`).focus();
    await page.keyboard.press('Shift+F10');
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    // Imprimir está deshabilitado, así que la segunda pulsación cae en Duplicar. Con localizador que
    // reintenta: sin zone.js, un getAttribute suelto lee el valor previo a la pulsación.
    const active = menu.locator('[role="menuitem"].bg-ghost-hover');
    await expect(active).toContainText('Duplicar');
    await expect
      .poll(() =>
        menu.evaluate((list) => list.getAttribute('aria-activedescendant') === list.querySelector('.bg-ghost-hover')?.id),
      )
      .toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.locator(`${DETALLE} [data-cell="0-0"]`)).toBeFocused();
  });

  test('choosing an entry reports the row AND the entry', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DETALLE} [data-kebab="1"] button`).click();
    await page.locator('[data-menu-item="anular"]').click();

    await expect(page.locator('[data-menu-choice]')).toContainText('Anular');
    await expect(page.locator('[data-menu-choice]')).toContainText('EXP-');
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  });

  test('lazy children show a loading row and then a row that says it failed', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    const demo = '[data-demo-perezosa]';
    // La expedición con incidencia es la que nunca recibe hijos.
    // Una sola fila abierta: sus filas de carga y de error son las únicas de la tabla.
    await page.locator(`${demo} tr.bg-danger-surface`).first().locator('[data-toggle]').click();
    await expect(page.locator(`${demo} [data-loading]`)).toBeVisible();
    await expect(page.locator(`${demo} [data-failed]`)).toBeVisible();
    await expect(page.locator(`${demo} [data-retry]`)).toBeVisible();
  });

  test('FIVE THOUSAND ROWS, A HANDFUL IN THE DOM, and the count is still five thousand', async ({
    page,
  }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator('[data-load-all]').click();
    await expect(page.locator('[data-loaded-count]')).toContainText('5000');

    const table = page.locator(`${VIRTUAL} table`);
    await expect(table).toHaveAttribute('aria-rowcount', '5000');

    // La ventana dibuja lo que cabe más el overscan, nunca las cinco mil: es toda la promesa de [virtual].
    const drawn = page.locator(`${VIRTUAL} [data-row]`);
    expect(await drawn.count()).toBeLessThan(80);
    expect(await drawn.count()).toBeGreaterThan(0);

    // Los espaciadores sostienen la barra de desplazamiento al largo de la tabla entera.
    await expect(page.locator(`${VIRTUAL} [data-spacer="after"]`)).toBeAttached();
  });

  test('the window moves with the scroll, and the index stays absolute', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator('[data-load-all]').click();
    await expect(page.locator('[data-loaded-count]')).toContainText('5000');

    const box = page.locator(`${VIRTUAL} [data-scroll-box]`);
    await box.evaluate((element) => {
      element.scrollTop = 32 * 1000;
    });

    // Fila mil menos el overscan: la primera dibujada está lejos de cero y su aria-rowindex es su
    // lugar en la tabla entera.
    const first = page.locator(`${VIRTUAL} [data-row]`).first();
    await expect(first).not.toHaveAttribute('data-row', '0');
    await expect
      .poll(() =>
        first.evaluate((row) => Number(row.getAttribute('aria-rowindex')) - Number(row.getAttribute('data-row'))),
      )
      .toBe(1);
  });

  test('the paginator appears because the source counts, and moves a page', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    const paginator = page.locator(`${PAGINADA} [data-pagination]`);
    await expect(paginator).toBeVisible();
    await expect(paginator.locator('[data-page-label]')).toContainText('Página 1 de');

    await paginator.locator('[data-previous-page] button').isDisabled();
    await paginator.locator('[data-next-page] button').click();
    await expect(paginator.locator('[data-page-label]')).toContainText('Página 2 de');

    // Veinticinco por página, y la página cambió de verdad.
    await expect(page.locator(`${PAGINADA} [data-row]`)).toHaveCount(25);
    await expect(page.locator(`${PAGINADA} [data-row="0"]`)).toContainText('UB-00026');
  });

  test('the paginator sheet disables the ends and drops the total on demand', async ({ page }) => {
    await page.goto(PAGINATION);
    await ready(page);

    const demo = '[data-demo-pagination]';
    await expect(page.locator(`${demo} [data-previous-page] button`)).toBeDisabled();
    await expect(page.locator(`${demo} [data-next-page] button`)).toBeEnabled();

    await page.locator(`${demo} [data-next-page] button`).click();
    await expect(page.locator('[data-page-value]')).toContainText('page = 1');
    await expect(page.locator(`${demo} [data-previous-page] button`)).toBeEnabled();

    await expect(page.locator(demo)).toContainText('filas');
    await page.locator('[data-toggle-total]').click();
    // Una fuente que no cuenta no dice cuántas hay.
    await expect(page.locator(demo)).not.toContainText('filas');
  });

  test('the filter row is one compact field tall, and no placeholder is cut', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator('[data-demo-table] [data-filters-toggle] button').click();
    const filterRow = page.locator('[data-demo-table] [data-filter-row]');
    await expect(filterRow).toBeVisible();

    // Los filtros son Small, mismo token que la fila compacta (--row-height-sm): un campo en una
    // celda mide exactamente una fila, y la fecha es un solo campo de rango (2026-09-21).
    for (const key of ['cliente', 'fecha']) {
      const field = filterRow.locator(`[data-filter="${key}"] input`);
      await expect(field).toHaveCount(1);
      expect(round((await field.boundingBox())?.height), key).toBe(32);
    }

    // Las dos cajas numéricas van lado a lado y la columna crece antes que cortarlas: encogidas
    // se leían «Desc» y «Hast». El ancho es preferencia; la legibilidad, no.
    const numbers = filterRow.locator('[data-filter="bultos"] input');
    await expect(numbers).toHaveCount(2);
    expect(round((await numbers.nth(0).boundingBox())?.y)).toBe(
      round((await numbers.nth(1).boundingBox())?.y),
    );
    for (const index of [0, 1]) {
      // scrollWidth no cuenta el placeholder: se mide con la fuente real del campo.
      const fits = await numbers.nth(index).evaluate((input: HTMLInputElement) => {
        const style = getComputedStyle(input);
        const context = document.createElement('canvas').getContext('2d')!;
        context.font = [style.fontWeight, style.fontSize, style.fontFamily].join(' ');
        const room =
          input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        // Con flechitas Chrome les reserva ancho aunque no se vean: la cuenta de arriba daba
        // «cabe» y en pantalla se leía «Desd» (2026-09-22). Sin ellas, la cuenta es la verdad.
        return style.appearance === 'textfield' && context.measureText(input.placeholder).width <= room;
      });
      expect(fits, `box ${index} fits its placeholder`).toBe(true);
    }
  });

  test('polish: the header stays while the rows scroll, only exceptions are tinted, dates read in a column', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await page.goto(TABLE);
    await ready(page);

    const demo = '[data-demo-table]';
    // Cabecera fija: la caja tiene alto máximo por token y desplaza adentro.
    const box = page.locator(`${demo} [data-scroll-box]`);
    await box.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const header = page.locator(`${demo} thead`);
    await expect
      .poll(async () => Math.round((await header.boundingBox())!.y - (await box.boundingBox())!.y))
      .toBe(0);

    // Solo «Con incidencia» y «En proceso» tiñen; el resto lleva el badge y nada más. Con poll:
    // una lectura del DOM que reintenta, nunca un getAttribute suelto.
    await expect
      .poll(() =>
        page.locator(`${demo} tbody tr[data-row]`).evaluateAll((rows) =>
          rows
            .filter(
              (row) =>
                /bg-(danger|warning)-surface/.test(row.className) !==
                /Con incidencia|En proceso/.test(row.querySelector('ewms-badge')?.textContent ?? ''),
            )
            .map((row) => row.textContent?.trim()),
        ),
      )
      .toEqual([]);

    // Día y mes con dos dígitos, desde el formateador.
    await expect(page.locator(`${demo} tbody tr[data-row] td:nth-child(4)`).first()).toHaveText(
      /^\s*\d{2}\/\d{2}\/2026\s*$/,
    );
  });
});
