import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The showroom, and the measurements that needed a browser.
 *
 * WHY THESE ASSERTIONS LIVE HERE AND NOT IN A UNIT TEST
 *
 * jsdom does no layout: every box it reports is zero, so none of this could be
 * checked before there was a page to render. Two of the criteria below have
 * been waiting since PR 1 for exactly that reason.
 *
 * The capture rig (playwright.capture.config.ts) is a separate config and does
 * NOT run here: screenshots without a baseline assert nothing. What survived
 * into this file is only what has a pass and a fail.
 */

import {
  PAGES,
  BANNER,
  BUTTON,
  CARD,
  CHECKBOX,
  DIALOG,
  ICON_BUTTON,
  INPUT,
  PAGINATION,
  RADIO,
  SEARCH_SELECT,
  SELECT,
  SPACING,
  TABLE,
  TEXT,
  TOAST,
  TOGGLE,
  TOOLTIP,
} from './routes';

/** Fonts change every width measured, so nothing is measured before they land. */
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

  test('the old Spanish icon route still works', async ({ page }) => {
    // The URLs were declared stable; a link already shared has to keep opening.
    await page.goto('/design-system/iconografia');
    await expect(page).toHaveURL(/\/design-system\/foundations\/icons$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Iconografía' })).toBeVisible();
  });

  test('the sidebar marks the page you are on', async ({ page }) => {
    await page.goto(BUTTON);
    const current = page.locator('[data-sidebar] a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('Botón');
  });

  test('the search filters the catalogue by name and by selector', async ({ page }) => {
    await page.goto('/design-system');
    const search = page.getByLabel('Buscar por nombre o selector');
    const links = page.locator('[data-sidebar] nav li');

    // Settle before counting: `count()` does not retry, and reading it while
    // the route is still rendering makes every later assertion nonsense.
    await expect(links.first()).toBeVisible();
    const total = await links.count();
    expect(total).toBeGreaterThan(20);

    /*
     * TWO SINCE DS-5, AND THAT IS THE SEARCH WORKING: «Toggle» matches by NAME
     * and «Favoritos» by its SELECTOR, `ewms-favorite-toggle`. Narrowing the
     * query to keep the number at one would test a coincidence instead of the
     * behaviour.
     */
    await search.fill('toggle');
    await expect(links).toHaveCount(2);

    // The selector is searchable too: it is what you type in a template.
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

/**
 * FAVOURITES, ACROSS THE SHELL AND THE CATALOGUE (DS-5 closing).
 *
 * Here and not in `smoke`, which is capped at twelve tests: what these defend
 * is a contract -- one list, and a route as the identity -- and every change
 * that can break it touches `design-system/`, `showroom/` or the shell's
 * layout, which is exactly when this project runs.
 *
 * A Spanish browser, so the first name on screen is the Spanish one and the
 * switch to English is the event under test rather than the starting point.
 */
test.describe('favourites: one list, and the route as the identity', () => {
  test.use({ locale: 'es-CR' });

  /**
   * ONE LIST OF FAVOURITES PER APPLICATION.
   *
   * The defect this closes: the showroom provided `EWMS_FAVORITES_STORE` a
   * second time, so a catalogue page had two stars over two lists, and marking
   * it in one left the other empty. State is provided once, by the shell; the
   * catalogue reads it by injection, the way it reads `EWMS_SHORTCUT_MAP`.
   */
  test('a catalogue page has ONE star, and the rail and the sidebar agree', async ({ page }) => {
    const route = '/design-system/components/button';
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Exactly one two-state button on the page, and it is the header's.
    const star = page.locator('[aria-pressed]');
    await expect(star).toHaveCount(1);
    await expect(page.locator('[data-app-header] [aria-pressed]')).toHaveCount(1);

    const inRail = page.locator(`ewms-nav-rail [data-favorite="${route}"]`);
    const inSidebar = page.locator(`[data-sidebar] [data-favorite="${route}"]`);

    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(inRail).toHaveCount(1);
    await expect(inSidebar).toHaveCount(1);
    // Each block names it in its own words, and neither shows a bare path.
    await expect(inSidebar).toHaveText('Botón');
    await expect(inRail).not.toContainText('/design-system');

    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await expect(inRail).toHaveCount(0);
    await expect(inSidebar).toHaveCount(0);
  });

  /**
   * A FAVOURITE IS A ROUTE (REQ-FE-DS4-002 v1.3).
   *
   * Until then it stored the name it had when it was marked, already
   * translated, so «Artículos» stayed «Artículos» in English -- a list half
   * translated, which is what ADR 0008 exists to prevent. Nothing is reloaded
   * and nothing is marked again below: the only thing that changes is the
   * language, and the name is resolved when the block draws.
   */
  test('a favourite follows the language, in the rail and in the catalogue', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav-item="catalogs"]').click();
    await page.locator('[data-nav-item="articles"]').click();
    await page.locator('[data-app-header] [data-favorite-toggle] button').click();

    const inRail = page.locator('ewms-nav-rail [data-favorite="/catalogos/articulos"]');
    await expect(inRail).toHaveText('Artículos');

    await page.locator('#language-switcher').selectOption('en');
    await expect(inRail).toHaveText('Articles');

    // The catalogue's sidebar reads the SAME list and asks the application for
    // the name, so it follows too -- inside a catalogue that is Spanish only.
    await page.locator('[data-nav-item="design-system"]').click();
    const inSidebar = page.locator('[data-sidebar] [data-favorite="/catalogos/articulos"]');
    await expect(inSidebar).toHaveText('Articles');

    await page.locator('#language-switcher').selectOption('es');
    await expect(inSidebar).toHaveText('Artículos');
    await expect(inRail).toHaveText('Artículos');
  });
});

/**
 * PENDING SINCE PR 1, NUMBER ONE.
 *
 * The whole reason the Loading state hides its content with `visibility` and
 * not `display` is that the box must not change. Measured by hand while the
 * Button was built: 83.23 x 40 in both states, and 40 x 40 for the icon
 * button. Nothing was watching it. Now something is.
 */
test.describe('Loading does not change the size of the control', () => {
  test('the button keeps its box, with an icon and without', async ({ page }) => {
    await page.goto(BUTTON);
    await ready(page);

    // Default and Loading are rendered side by side in the state matrix, which
    // is the only place both exist at once with identical content.
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

    // With an icon: the demo button carries one, so it is measured across its
    // own transition rather than against a different button.
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

    // The accessible name survives `visibility: hidden` through aria-labelledby:
    // the name is still 'Confirmar recepción' while the content is hidden.
    await expect(page.getByRole('button', { name: 'Confirmar recepción' })).toHaveCount(1);
    // Focus stays put: that is why Loading uses aria-disabled and not the
    // native attribute, which would drop focus to <body>.
    await expect(submit).toBeFocused();

    await submit.click({ force: true });
    await submit.press('Enter');
    await expect(counter).toHaveText('Envíos registrados: 1');
  });

  test('the icon button stays square while loading', async ({ page }) => {
    await page.goto(BUTTON);
    await ready(page);

    // Two real instances, one idle and one loading, so the comparison is
    // between rendered controls and not between a control and an attribute.
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

/**
 * PENDING SINCE PR 1, NUMBER TWO.
 *
 * A floating panel has to flip when it does not fit. It was never tested
 * because jsdom does no layout, so the position strategies shipped unproven.
 * The triggers are moved to each edge from the test rather than a page being
 * built to hold them: what is under test is the overlay's behaviour, not a
 * layout somebody would ever ship.
 */
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
      /*
       * Not `[role="tooltip"]`: the panel only takes that role when the
       * directive is marked `describes`. Beside a control that already has its
       * own name it is aria-hidden decoration, so it is found by the id the
       * directive generates.
       */
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

    const trigger = host.locator('button').first();
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

    const trigger = page.locator('[data-demo-select] button').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();

    const panel = page.locator('[role="listbox"]');
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    const triggerBox = await trigger.boundingBox();
    expect(round(panelBox!.y)).toBeCloseTo(round(triggerBox!.y + triggerBox!.height), 0);
    // The panel is sized to the trigger, so the list has to be too: see the
    // `w-full` note in select.types.ts.
    expect(round(panelBox!.width)).toBeCloseTo(round(triggerBox!.width), 0);
  });
});

/**
 * The geometry nobody had measured. Every number here is a claim tokens.css or
 * a component sheet makes; a failure means the claim and the code disagree,
 * and that is a defect either way.
 */
test.describe('the fixed geometry of the system', () => {
  test('the three control heights are 32, 40 and 48', async ({ page }) => {
    await page.goto(BUTTON);
    await ready(page);

    for (const [size, expected] of [
      ['sm', 32],
      ['md', 40],
      ['lg', 48],
    ] as const) {
      const box = await page.locator(`[data-size-sample="${size}"] button`).boundingBox();
      expect(round(box?.height), `button ${size}`).toBe(expected);
    }
  });

  test('a field and a button of the same size share the same box', async ({ page }) => {
    await page.goto(SPACING);
    await ready(page);

    const input = await page.locator('[data-measure="mixed-input"] input').boundingBox();
    const select = await page.locator('[data-measure="mixed-select"] button').boundingBox();
    const button = await page.locator('[data-measure="mixed-button"] button').boundingBox();

    expect(round(input?.height), 'input md').toBe(40);
    expect(round(select?.height), 'select md').toBe(40);
    expect(round(button?.height), 'button md').toBe(40);
    // The rule the mixed row exists to protect: they line up optically.
    expect(round(input?.y)).toBe(round(button?.y));
    expect(round(select?.y)).toBe(round(button?.y));
  });

  test('the selection box is 18x18 with a 1.5 border', async ({ page }) => {
    await page.goto(SPACING);
    await ready(page);

    for (const control of ['checkbox', 'radio']) {
      const box = await page.locator(`[data-measure="${control}-row"] input`).boundingBox();
      expect(round(box?.width), `${control} width`).toBe(18);
      expect(round(box?.height), `${control} height`).toBe(18);

      /*
       * The DECLARATION is asserted, not the used value.
       *
       * Chromium floors a sub-pixel border: a literal `border-width: 1.5px`
       * also reports `1px` from getComputedStyle, at every device pixel ratio.
       * Asserting the used value would therefore be asserting a browser
       * rounding rule and would fail the day it changed, while saying nothing
       * about whether the token reached the control. What the component owes
       * is the token; what the browser does with it is the browser's.
       *
       * The consequence -- that `--border-width-selection` does not actually
       * paint 1.5px in Chromium -- is written up in the DS-2 PR 3 report.
       */
      const declared = await page
        .locator(`[data-measure="${control}-row"] input`)
        .evaluate((el) => ({
          inline: (el as HTMLElement).style.borderWidth,
          token: getComputedStyle(el).getPropertyValue('--border-width-selection').trim(),
        }));
      expect(declared.inline, `${control} border declaration`).toBe(
        'var(--border-width-selection)',
      );
      expect(declared.token, `${control} border token`).toBe('1.5px');
    }
  });

  test('the toggle track is 44x24 and the thumb 20', async ({ page }) => {
    await page.goto(SPACING);
    await ready(page);

    const track = await page.locator('[data-measure="toggle-row"] input').boundingBox();
    expect(round(track?.width), 'track width').toBe(44);
    expect(round(track?.height), 'track height').toBe(24);
  });
});

/**
 * The claims the new sheets make about themselves, checked in a browser.
 *
 * Every one of these pages reads a number off its own DOM instead of printing
 * one. That is only worth anything if the number it reads is the right one,
 * which is what these assert -- and what jsdom cannot, because it lays nothing
 * out.
 */
test.describe('the component sheets measure what they claim', () => {
  test('the icon button is square at the three sizes, over the 2.5.8 minimum', async ({ page }) => {
    await page.goto(ICON_BUTTON);
    await ready(page);

    for (const [size, expected] of [
      ['sm', 32],
      ['md', 40],
      ['lg', 48],
    ] as const) {
      const box = await page.locator(`[data-size-sample="${size}"] button`).boundingBox();
      expect(round(box?.width), `icon button ${size} width`).toBe(expected);
      expect(round(box?.height), `icon button ${size} height`).toBe(expected);
    }
    // The page derives the 2.5.8 verdict from what it measured, so the absence
    // of the failing badge is the assertion that the derivation agrees.
    await expect(page.getByText('por debajo de')).toHaveCount(0);
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
        .locator(`[data-chevron-sample="${size}"] button svg`)
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
      // The page prints the DECLARATION, for the reason set out above.
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

    const trigger = page.locator('[data-demo-select] button').first();
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
      /*
       * Wait for the page, not just for the fonts. The route is lazy, and axe
       * run against a document that has not rendered yet reports the absence
       * of the whole application -- sixty-odd violations that say nothing
       * about the page under test and come and go with the machine's load.
       */
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await ready(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

/**
 * THE KEYBOARD WALK -- the exit criterion of DS-2 and step 3 of the comanda.
 *
 * The comanda's "listo cuando" is being able to go through the catalogue end
 * to end with Tab, Enter and the arrow keys. Until now that was a claim
 * nobody had checked: axe covers contrast and semantics and says nothing
 * about whether the tab order reaches everything, or reaches something twice.
 *
 * WHY THE EXPECTED SET IS READ OFF THE DOM AND NOT WRITTEN DOWN HERE.
 * A hand-written list of controls per page goes stale the first time a page
 * gains a button, and goes stale silently -- the test keeps passing while the
 * thing it was written to protect stops being true. So each page is asked
 * what interactive elements it is showing, every one of them is stamped, and
 * the walk has to visit exactly that set: nothing missing, nothing twice, and
 * nothing focused that was not in it.
 */

/** A tab stop, as observed. `kbd` is the stamp put on the element beforehand. */
interface TabStop {
  readonly kbd: string | null;
  readonly tag: string;
  readonly label: string;
  /** The design system's focus ring is a box-shadow; the shell's chrome is unstyled. */
  readonly boxShadow: string;
  readonly outlineStyle: string;
  readonly outlineWidth: string;
  /** False only for the shell's provisional header, which DS-5 replaces. */
  readonly inShowroom: boolean;
}

interface Stamped {
  /** Stamps of every visible, enabled, focusable element on the page. */
  readonly expected: readonly string[];
  /** Human-readable, so a failure says WHICH control went missing. */
  readonly labels: Readonly<Record<string, string>>;
  /** Stamps of the disabled controls, which must never appear in the walk. */
  readonly disabled: readonly string[];
  /**
   * The radios of a group that are NOT its tab stop.
   *
   * A radio group is ONE stop, not one per option: Tab enters the group at
   * the checked radio (or the first, when none is checked) and the arrows
   * move within it. That is native behaviour and it is the behaviour the
   * comanda asks for -- "flechas mueven un grupo de radios". So these must be
   * absent from the walk for the same reason a disabled control must: their
   * presence would mean the group is broken into separate stops.
   */
  readonly roving: readonly string[];
}

/**
 * A walk cannot run for ever. Forty-odd stops is a full page (sixteen in the
 * sidebar plus the content); three hundred means the cycle never closed,
 * which is itself the failure worth reporting.
 */
const MAX_TABS = 300;

/**
 * How many tabs stand between the top of the DOCUMENT and the catalogue
 * search, and how many stand between the top of the SHOWROOM and it.
 *
 * The rule exists so that the sidebar cannot become a wall of thirty links in
 * front of the search. It is not: the search sits above the catalogue links,
 * so from the showroom's own first stop it is the second one, and that is the
 * number the showroom controls.
 *
 *
 * THE DOCUMENT NUMBER, AND HOW DS-5 CLOSED IT (2026-09-19)
 *
 * DS-2 measured FIVE from the top of the document and reported the gap: the
 * comanda asks for three, and three of the five were the shell's provisional
 * header. DS-5 replaced that header with the real App Shell -- which has MORE
 * chrome, not less: a rail, a tab strip, a trail, a star, a search of its own.
 * Counting raw Tab presses, the catalogue search is now the twelfth stop.
 *
 * What closes the gap is not a shorter header. It is the SKIP LINK, which is
 * the first thing in the document and lands on `<main>`: Tab, Enter, and then
 * the two stops the showroom owns. THREE, which is the comanda's number, and
 * the route a keyboard user actually takes on every screen rather than on this
 * one.
 *
 * The raw count is asserted too, so the chrome cannot grow unnoticed. It is a
 * ceiling, not a target: what has to stay small is the number below.
 */
const TABS_TO_SEARCH_VIA_SKIP_LINK = 3;
const TABS_TO_SEARCH_IN_DOCUMENT = 12;
const TABS_TO_SEARCH_IN_SHOWROOM = 2;

/**
 * Stamp every focusable element with `data-kbd`, and hand back what the walk
 * is expected to visit.
 *
 * "Visible" is measured, not assumed: a box with no area, `display:none`,
 * `visibility:hidden`, or an `aria-hidden` / `inert` ancestor is not
 * something a keyboard user can reach, so it is not something the walk owes a
 * stop.
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

    /**
     * Which radio of each group is the group's tab stop: the checked one, or
     * the first when none is checked. Grouping is by form + name, which is
     * exactly how the browser groups them.
     */
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

    /** Elements the browser puts in the tab order all by themselves. */
    const NATIVELY_FOCUSABLE = ['a', 'area', 'button', 'input', 'select', 'textarea', 'summary'];

    for (const el of Array.from(document.querySelectorAll(SELECTOR))) {
      const tabindex = el.getAttribute('tabindex');
      /*
       * A negative tabindex on a <div> is a programmatic focus target and a
       * perfectly ordinary thing. On a BUTTON, an INPUT or a link it is the
       * bug this whole walk exists to find: the control is still visible,
       * still enabled, still looks operable -- and the keyboard cannot reach
       * it. So it is skipped only for the elements that were not in the tab
       * order to begin with.
       */
      if (
        tabindex !== null &&
        Number(tabindex) < 0 &&
        !NATIVELY_FOCUSABLE.includes(el.tagName.toLowerCase())
      ) {
        continue;
      }

      /*
       * A ROVING MEMBER OF A COMPOSITE WIDGET IS NOT A MISSING TAB STOP.
       *
       * `tabindex="-1"` on a button is normally the bug this walk exists to
       * find: visible, enabled, and unreachable. Inside a `tree`, a `tablist`
       * or a `treegrid` it is the opposite -- it is the APG pattern, where the
       * whole widget is ONE stop and the arrows do the rest. The rail carries
       * sixteen destinations; a Tab stop each would cost sixteen presses to
       * get past the navigation on every screen.
       *
       * This does not soften the rule. A `tabindex="-1"` button OUTSIDE a
       * composite still fails, and the new assertion below is stricter than
       * what was here before: each composite must have EXACTLY ONE stop.
       */
      /*
       * `tree` and `tablist` ONLY, and not `treegrid`. A grid's keyboard model
       * is different: its cells legitimately hold controls of their own, and
       * the Table's sheet has thirty-five of them. Adding it here would have
       * excused a genuinely unreachable button inside a cell, which is the
       * defect this walk exists to find.
       */
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

      /*
       * `disabled` the ATTRIBUTE, not aria-disabled. The Button in its
       * Loading state carries aria-disabled precisely so that it KEEPS its
       * focus (see the note in button.ts), so it stays in the tab order and
       * the walk owes it a stop. A natively disabled control does not.
       */
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

/** Where the focus is right now, with everything the assertions need about it. */
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
      /*
       * The showroom owns the catalogue; the App Shell owns the frame around
       * it. Before DS-5 the frame was one provisional header with a class of
       * its own; now it is a header, a rail, a tab strip and a trail, so the
       * question is asked of all four.
       */
      inShowroom: !el.closest(
        '[data-app-header], [data-skip-link], ewms-nav-rail, ewms-nav-bottom, ewms-tabs, ewms-breadcrumbs',
      ),
    };
  });
}

/**
 * Tab from the top of the document until the focus comes back round, and
 * report every stop on the way.
 */
async function walkTabCycle(page: Page): Promise<readonly TabStop[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    // Start from the very top of the document, so the first Tab lands on the
    // first focusable element and not wherever a previous action left off.
    document.body.setAttribute('tabindex', '-1');
    document.body.focus();
    document.body.removeAttribute('tabindex');
  });

  const stops: TabStop[] = [];
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const stop = await readFocus(page);
    const first = stops[0];
    // The cycle closed: either the focus fell back to the document, or it
    // came round to where it started.
    if (stop.tag === 'BODY' || (first !== undefined && stop.kbd === first.kbd)) {
      break;
    }
    stops.push(stop);
  }
  return stops;
}

/** Duplicated stamps in the order they were revisited. */
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

      // Nothing outside the stamped set: a stop with no stamp is an element
      // that was not there when the page was measured.
      expect(
        stops.filter((stop) => stop.kbd === null).map((stop) => stop.label),
        `${url}: focus landed on an unstamped element`,
      ).toEqual([]);

      // Every visible control is reachable.
      expect(
        expected.filter((kbd) => !visited.includes(kbd)).map((kbd) => labels[kbd]),
        `${url}: never reached by Tab`,
      ).toEqual([]);

      // None of them twice in one cycle.
      expect(
        duplicates(visited).map((kbd) => labels[kbd]),
        `${url}: focused twice in one cycle`,
      ).toEqual([]);

      // A disabled control is not a tab stop.
      expect(
        disabled.filter((kbd) => visited.includes(kbd)).map((kbd) => labels[kbd]),
        `${url}: disabled control in the tab order`,
      ).toEqual([]);

      // Neither is a radio that is not its group's entry point: a group is one
      // stop, and the arrows do the rest.
      expect(
        roving.filter((kbd) => visited.includes(kbd)).map((kbd) => labels[kbd]),
        `${url}: a radio group was split into several tab stops`,
      ).toEqual([]);

      /*
       * A COMPOSITE WIDGET IS ONE TAB STOP. NOT TWO, AND NOT NONE.
       *
       * The counterpart of treating roving members as expected-not-to-be-
       * stops: if a `tree` or a `tablist` is on the page, exactly one of its
       * members must be in the tab order. None means the whole widget is
       * unreachable; two means the roving tabindex is broken and it has
       * started costing a stop per member again.
       */
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

      /*
       * WCAG 2.4.7: every stop has to SHOW that it has the focus.
       *
       * BOX-SHADOW **OR** OUTLINE, and the difference is deliberate rather
       * than a loophole. The system's ring is a box-shadow
       * (--focus-ring-shadow) and that is what almost everything uses, but
       * the icon grid in /foundations/icons uses `outline-2 outline-focus` on
       * its seventy tiles -- an outline is drawn outside the box and does not
       * bleed over the neighbouring tile the way a 3px shadow would. That is
       * a token-driven indicator and a correct one; demanding a box-shadow
       * there would break a working grid to satisfy the letter of a rule
       * whose point is that the focus must be VISIBLE.
       *
       * What this does still catch is the case with no indicator at all, and
       * it caught one: a focusable <span> on the tooltip page that had no
       * focus styling of its own.
       */
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

      /*
       * And the indicator has to be OURS.
       *
       * `outline-style: auto` is the browser's own ring, which every focusable
       * element gets for free. It is visible, so the assertion above lets it
       * pass -- but a catalogue whose job is to be the one place the system
       * looks like itself cannot have a control falling back to the browser
       * default. A token ring is a box-shadow, or an explicit outline
       * (`solid`, from `outline-2 outline-focus`); never `auto`.
       *
       * The shell's provisional header is exempt: it is unstyled on purpose
       * and DS-5 replaces it, which is out of scope here.
       */
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

  /**
   * THE SKIP LINK IS THE ROUTE TO THE SEARCH, AND IT COSTS THREE.
   *
   * The comanda asks for the catalogue search within three Tab presses. Before
   * DS-5 it was five and the gap was reported; the App Shell has more chrome
   * than the provisional header did, so the raw count went up rather than
   * down. The skip link is what makes the number true: first in the document,
   * lands on `<main>`, and from there the search is the showroom's own two.
   *
   * The skip link deliberately targets `main` and NOT the page's `h1`: on this
   * page the heading sits after the sidebar, so landing on it would take you
   * PAST the search you were skipping to.
   */
  test('the skip link puts the catalogue search three Tab presses away', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await ready(page);

    await stampFocusable(page);

    // One Tab from the top of the document: the skip link, and nothing before.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
      document.body.removeAttribute('tabindex');
    });
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-skip-link]')).toBeFocused();

    // Enter, and then count to the search.
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

  /**
   * THE THIRD NUMBER OF THE SHEET: ZERO, WITH `/`.
   *
   * App-Shell.md gives three counts for reaching a search from this page --
   * 12 from the top of the document, 3 by the skip link, 0 with the shortcut
   * -- and until the DS-5 closing only the first two were asserted here. The
   * measure the comanda asks for is the one counted FROM THE SKIP LINK, which
   * is the first focusable element and where a keyboard user really starts;
   * the other two are what it costs to ignore it and what it costs to know
   * the shortcut.
   *
   * `/` lands in the APPLICATION's search, in the header: the catalogue does
   * not claim the shortcut, so the shell answers it, on every screen.
   */
  test('`/` reaches a search with no Tab at all', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await ready(page);
    await page.getByRole('heading', { level: 1 }).first().click();

    await page.keyboard.press('/');

    await expect(page.locator('[data-shell-search]')).toBeFocused();
  });

  /**
   * The sidebar must not be a wall you tab through to reach the search. The
   * search sits ABOVE the catalogue links for exactly this reason, so from the
   * showroom's own first stop it is the second.
   */
  test('the sidebar is not a wall in front of the catalogue search', async ({ page }) => {
    await page.goto('/design-system');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await ready(page);

    await stampFocusable(page);
    const stops = await walkTabCycle(page);
    const chain = stops.map((stop) => stop.label).join(' -> ');
    const index = stops.findIndex((stop) => stop.label.includes('#showroom-search'));

    expect(index, `the search was never reached by Tab. Order: ${chain}`).toBeGreaterThanOrEqual(0);

    // From the top of the document, the App Shell's whole chrome included.
    // A ceiling rather than a target: the route that matters is the skip
    // link's, asserted above.
    expect(
      index + 1,
      `tabs to the search: ${stops
        .slice(0, index + 1)
        .map((stop) => stop.label)
        .join(' -> ')}`,
    ).toBeLessThanOrEqual(TABS_TO_SEARCH_IN_DOCUMENT);

    // From the showroom's own first stop -- the part the showroom owns, and
    // the part the rule is actually about.
    const firstInShowroom = stops.findIndex((stop) => stop.inShowroom);
    expect(firstInShowroom, `no showroom stop at all. Order: ${chain}`).toBeGreaterThanOrEqual(0);
    expect(
      index - firstInShowroom + 1,
      `tabs from the first showroom stop to the search, within: ${chain}`,
    ).toBeLessThanOrEqual(TABS_TO_SEARCH_IN_SHOWROOM);

    // And the catalogue links really are behind it, which is what makes the
    // number above stay small as the catalogue grows.
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
    // The "select all" box above is driven by the group, so a keyboard tick
    // has to move it to mixed exactly as a click would.
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

    const trigger = page.locator('[data-demo-select] button').first();
    const panel = page.locator('[role="listbox"]');
    const value = page.locator('[data-demo-value]');

    // Enter opens it.
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeVisible();

    // Escape closes WITHOUT choosing, and the focus never left the trigger --
    // which is the point of the aria-activedescendant pattern in select.ts.
    const untouched = await value.textContent();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(value).toHaveText(untouched ?? '');

    // Space opens it too: the trigger is a <button>, so the native activation
    // key works without a handler of its own.
    await page.keyboard.press('Space');
    await expect(panel).toBeVisible();

    // The arrows move the ACTIVE row, and the focus still does not move.
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toBeFocused();
    const active = await trigger.getAttribute('aria-activedescendant');
    expect(active, 'the arrows must mark an active option').not.toBeNull();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(value).not.toHaveText(untouched ?? '');
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

  test('Enter on a button activates it, and the busy button refuses the second press', async ({
    page,
  }) => {
    await page.goto(BUTTON);
    await ready(page);

    const submit = page.locator('[data-demo-submit] button');
    const counter = page.locator('[role="status"]', { hasText: 'Envíos registrados' });

    await submit.focus();
    await page.keyboard.press('Enter');
    await expect(submit).toHaveAttribute('aria-busy', 'true');
    await expect(counter).toHaveText('Envíos registrados: 1');

    // Still focused, so a keyboard user is not dumped back to the top of the
    // document mid-submit -- and a second Enter changes nothing.
    await expect(submit).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(counter).toHaveText('Envíos registrados: 1');
  });
});

/**
 * DS-3 LOTE A — the facts that needed a browser.
 *
 * The three sheets built in this lote make claims jsdom cannot judge: an icon
 * that does not grow with the severity, an accent bar four pixels wide, and a
 * group of cards that is one tab stop rather than four. All three are read off
 * the rendered page here, and all three are shown on the page itself, so a
 * failure names the same number a reader would have seen.
 */
test.describe('DS-3 lote A: notificaciones y card', () => {
  test('the banner keeps its icon at 18 px in all four variants', async ({ page }) => {
    await page.goto(BANNER);
    await ready(page);

    for (const variant of ['success', 'warning', 'danger', 'info'] as const) {
      const icon = await page.locator(`[data-icon-sample="${variant}"] svg`).boundingBox();
      expect(round(icon?.width), `banner ${variant} icon width`).toBe(18);
      expect(round(icon?.height), `banner ${variant} icon height`).toBe(18);
    }
    // The page derives its own verdict from the same read.
    await expect(page.getByText('no son 18 px')).toHaveCount(0);
  });

  test('the banner does not remove itself when it is dismissed', async ({ page }) => {
    await page.goto(BANNER);
    await ready(page);

    const banner = page.locator('[data-demo-banner] ewms-banner');
    await expect(banner).toBeVisible();

    await page.locator('[data-demo-banner] button').click();

    await expect(page.locator('[data-dismiss-count]')).toHaveText('1');
    // Still there: whether it goes away is the consumer's call.
    await expect(banner).toBeVisible();
  });

  test('a toast comes up in the shell outlet, with a 4 px accent, and Escape closes it', async ({
    page,
  }) => {
    await page.goto(TOAST);
    await ready(page);

    const stack = page.locator('[role="status"][aria-live="polite"]');
    // ONE live region in the whole document, even before anything is in it.
    await expect(stack).toHaveCount(1);

    await page.locator('[data-raise-sticky] button').click();

    const toast = stack.locator('> div');
    await expect(toast).toHaveCount(1);

    const accent = await toast.locator('> span').boundingBox();
    expect(round(accent?.width), 'toast accent width').toBe(4);
    await expect(page.locator('[data-accent-width]')).toHaveText('4 px');

    // A toast that was raised with duration 0 never expires on its own; the
    // keyboard is the only way out, and it takes the most recent one.
    await page.keyboard.press('Escape');
    await expect(toast).toHaveCount(0);
  });

  test('a toast with the default duration goes away on its own', async ({ page }) => {
    await page.goto(TOAST);
    await ready(page);

    await page.locator('[data-raise="success"] button').click();
    const toast = page.locator('[role="status"][aria-live="polite"] > div');
    await expect(toast).toHaveCount(1);

    // --duration-toast is 3000 ms; the wait is the token's value plus slack,
    // and the point of the assertion is that SOMETHING expired it -- the
    // service read the token rather than inventing a number.
    await expect(toast).toHaveCount(0, { timeout: 6000 });
  });

  test('the card group is one tab stop, and the arrows choose inside it', async ({ page }) => {
    await page.goto(CARD);
    await ready(page);

    const cards = page.locator('[data-demo-warehouses] [role="radio"]');
    await expect(cards).toHaveCount(4);
    await expect(page.locator('[data-tab-stops]')).toHaveText('1');

    // Enter the group at the chosen card, which the form seeded with Central.
    await cards.nth(1).focus();
    await expect(cards.nth(1)).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('ArrowDown');
    await expect(cards.nth(2)).toHaveAttribute('aria-checked', 'true');
    await expect(cards.nth(2)).toBeFocused();
    await expect(page.locator('[data-demo-value]')).toHaveText('devoluciones');

    // Sur is unavailable, so the next one round is Norte: the arrows skip a
    // disabled card and wrap, which is what a radio group does.
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

    // The fill and the border are different colours, and there is a glyph.
    expect(marks.background).not.toBe(marks.border);
    expect(marks.check).toBeGreaterThan(0);
  });
});

/**
 * DS-3 LOTE B — the dialog and the search select, in a browser.
 *
 * Both of these are mostly behaviour that jsdom can only approximate: a focus
 * trap, a backdrop, a scan arriving faster than a person can type. The unit
 * specs cover the logic; what is here is the part that needed a real browser
 * and a real keyboard.
 */
test.describe('DS-3 lote B: dialog', () => {
  test('opens, traps the focus, and gives it back to whoever opened it', async ({ page }) => {
    await page.goto(DIALOG);
    await ready(page);

    const opener = page.locator('[data-open="info"] button');
    await opener.focus();
    await opener.press('Enter');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // The focus lands on Cancel: it is first in the DOM so the keyboard
    // arrives at the safe answer.
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();

    // It really is a trap: tabbing round the two buttons never leaves.
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

    const labelledBy = await dialog.getAttribute('aria-labelledby');
    const describedBy = await dialog.getAttribute('aria-describedby');
    expect(labelledBy).toBeTruthy();
    expect(describedBy).toBeTruthy();

    await expect(page.locator(`#${labelledBy}`)).toContainText('Eliminar la expedición');
    await expect(page.locator(`#${describedBy}`)).toContainText('34 bultos');
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

  test('the icon zone is 56 px of shape with no glyph in it', async ({ page }) => {
    await page.goto(DIALOG);
    await ready(page);

    for (const tone of ['danger', 'warning', 'info'] as const) {
      const halo = page.locator(`[data-halo="${tone}"]`);
      const box = await halo.boundingBox();
      expect(round(box?.width), `${tone} halo width`).toBe(56);
      expect(round(box?.height), `${tone} halo height`).toBe(56);
      // The documented exception: a shape, and nothing inside it.
      await expect(halo.locator('svg')).toHaveCount(0);
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

    // Navy at 50 %, not black: the overlay tints the scene with the brand.
    expect(backdrop.background).toBe('rgba(1, 15, 66, 0.5)');
    expect(backdrop.filter).toContain('blur');
  });
});

test.describe('DS-3 lote B: selector con búsqueda', () => {
  const FIELD = '[data-demo-search] input[role="combobox"]';

  test('filters as you type, with nothing opened first', async ({ page }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    await expect(page.locator('[role="listbox"]')).toHaveCount(0);

    await page.locator(FIELD).fill('caja');
    await expect(page.locator('[role="listbox"]')).toBeVisible();
    await expect(page.locator('[role="listbox"] [role="option"]').first()).toBeVisible();
  });

  test('a scan resolves without the panel ever opening', async ({ page }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    const field = page.locator(FIELD);
    await field.focus();

    /*
     * No delay at all: a gun, not a person. REQ-FE-DS3-001's own checkpoint
     * asks for exactly this simulation -- the threshold is 50 ms and a human
     * at full speed sits around 120 -- and a real scanner emits faster than
     * any number written here.
     *
     * It USED to ask for 5 ms between keys, which spends a tenth of the
     * budget on purpose and left the rest to whatever else the machine was
     * doing. On a loaded runner one of those gaps crossed 50 ms and the burst
     * read as typing: one red test in a full suite, green on its own. The
     * delay was the flake, so the delay went.
     */
    await page.keyboard.type('SKU-88042', { delay: 0 });
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-demo-value]')).toContainText('SKU-88042');
    // Zero clicks, and the panel never came up.
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  });

  test('typing the same code at human speed opens the panel instead', async ({ page }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    const field = page.locator(FIELD);
    await field.focus();
    await page.keyboard.type('SKU-88042', { delay: 150 });

    await expect(page.locator('[role="listbox"]')).toBeVisible();
    await expect(page.locator('[data-demo-value]')).toHaveText('(ninguno)');
  });

  test('the error is in the flow, and one Tab from the field reaches its retry', async ({
    page,
  }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    await page.locator('[data-behaviour="failing"] button').click();
    await page.locator(FIELD).fill('caja');

    const alert = page.locator('[data-demo-search] [role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('No se pudo consultar');

    // Where "no results" would have been, there is nothing: the two states are
    // different and they are not in the same place.
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);

    await page.locator(FIELD).focus();
    await page.keyboard.press('Tab');
    await expect(alert.getByRole('button', { name: 'Reintentar' })).toBeFocused();
  });

  test('a source slower than the timeout is an error, not an empty warehouse', async ({ page }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    await page.locator('[data-behaviour="slow"] button').click();
    await page.locator(FIELD).fill('caja');

    const alert = page.locator('[data-demo-search] [role="alert"]');
    await expect(alert).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-demo-search]')).not.toContainText('Sin resultados');
  });

  test('pages: the next page is appended, and changing the text starts over', async ({ page }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    await page.locator(FIELD).fill('SKU');
    const options = page.locator('[role="listbox"] [role="option"]');
    // Twenty results plus the "load more" row.
    await expect(options).toHaveCount(21);

    await options.last().click();
    await expect(options).toHaveCount(41);

    await page.locator(FIELD).fill('SKU-88042');
    await expect(options).toHaveCount(1);
  });

  test('works when the source declines to count', async ({ page }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    await page.locator('[data-toggle-counts] button').click();
    await expect(page.locator('[data-counts-value]')).toContainText('total: null');

    await page.locator(FIELD).fill('SKU');
    await expect(page.locator('[role="listbox"] [role="option"]')).toHaveCount(21);
    // The live region says what it can, without a total.
    await expect(page.locator('[data-demo-search] [role="status"]')).toContainText('20 resultados');
  });

  test('the arrows walk the list and Escape gives nothing away', async ({ page }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    const field = page.locator(FIELD);
    await field.fill('caja');
    /*
     * The panel opens when the QUERY STARTS, not when it answers -- that is
     * RFE-01, and it is why there is a searching state at all. So waiting for
     * the panel is not enough: the arrows have nothing to move over until a
     * row exists.
     */
    await expect(page.locator('[role="listbox"] [role="option"]').first()).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-activedescendant', /-option-0$/);
    await page.keyboard.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-activedescendant', /-option-1$/);

    await page.keyboard.press('Escape');
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
    await expect(page.locator('[data-demo-value]')).toHaveText('(ninguno)');
    await expect(field).toBeFocused();

    // And Enter on an active row chooses the record, not the text.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-demo-value]')).toContainText('SKU-');
  });

  test('the three sizes are the system scale: 32 / 40 / 48', async ({ page }) => {
    await page.goto(SEARCH_SELECT);
    await ready(page);

    for (const [size, expected] of [
      ['sm', 32],
      ['md', 40],
      ['lg', 48],
    ] as const) {
      const box = await page.locator(`[data-size-sample="${size}"] input`).boundingBox();
      expect(round(box?.height), `search select ${size}`).toBe(expected);
    }
  });
});

/**
 * DS-3 LOTE C — the table, in a browser.
 *
 * The unit spec covers the logic; what needed a browser is the geometry, the
 * real keyboard, and the claim the whole API was designed against: how many
 * lines the consumer writes.
 */
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
    // The comanda's ceiling for the expediciones demo. If this fails, the API
    // is what needs fixing, not the page.
    expect(printed).toBeLessThanOrEqual(40);
    await expect(page.locator('[data-component-lines]')).toHaveText('2');
  });

  test('a row is exactly as tall as an input of the same size', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    const row = await page.locator(ROWS).first().boundingBox();
    // The Input page's Medium field, measured on its own sheet: the two are
    // the same token, and a cell has to be able to hold one without growing.
    await page.goto(INPUT);
    await ready(page);
    const input = await page.locator('[data-pair="md"] input').boundingBox();

    expect(round(row?.height)).toBe(40);
    expect(round(input?.height)).toBe(40);
  });

  test('the compact density really is the other token', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator('[data-density="sm"]').click();
    await expect(page.locator('[data-density-value]')).toHaveText('sm');

    const row = await page.locator(ROWS).first().boundingBox();
    expect(round(row?.height)).toBe(32);
  });

  test('expands three levels into ONE table', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await expect(page.locator(ROWS)).toHaveCount(12);
    await expect(page.locator(`${ROWS}[aria-level="2"]`)).toHaveCount(0);

    await page.locator(`${DEMO} [data-toggle="0"]`).click();
    // Retrying assertions throughout: a bare `count()` reads whatever is there
    // at that instant, which is how the badge assertion below went red once.
    await expect(page.locator(`${ROWS}[aria-level="2"]`).first()).toBeVisible();

    // The first line of that header, opened in turn.
    await page.locator(`${DEMO} [data-toggle="1"]`).click();
    await expect(page.locator(`${ROWS}[aria-level="3"]`).first()).toBeVisible();

    // Three levels, and still one table: no nesting anywhere.
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

    /*
     * `aria-level` tells a screen reader where a row sits; the indentation is
     * what tells everybody else, and it is one token per level. It was zero
     * for a while: the spacer's width was `calc(level * var(--spacing) * 5)`,
     * and `--spacing` generates Tailwind's spacing utilities without reaching
     * the document as a custom property, so the whole calc resolved to
     * nothing and three levels drew flush. Nothing failed -- the tree was
     * correct, announced correctly, and looked like a flat list.
     */
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

    // And it shows: the child's text starts one indent to the right of its
    // parent's, which is the whole visible difference between a tree and a
    // list.
    expect(round((child?.x ?? 0) - (parent?.x ?? 0))).toBe(20);
  });

  test('walks the tree with the arrows alone', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    // One Tab stop for the whole table: focus the first cell directly and
    // drive from there, which is what a keyboard user gets after one Tab.
    await page.locator(`${DEMO} [data-cell="0-0"]`).focus();

    await page.keyboard.press('ArrowRight');
    await expect(page.locator(`${ROWS}[aria-level="2"]`).first()).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await expect(page.locator(`${DEMO} [data-cell="1-0"]`)).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    // First cell of a child row: up to the parent rather than sideways.
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

    // Ascending as NUMBERS. The cells show a grouped, localised string, and
    // sorting by that text is what puts 1.200 before 900.
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  test('filters a number range with two boxes, and an empty box is unbounded', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    const boxes = page.locator(`${DEMO} [data-filter="bultos"] input`);
    await expect(boxes).toHaveCount(2);

    await boxes.nth(0).fill('100');
    await expect(page.locator('[data-query]')).toContainText('bultos');
    const withMin = await page.locator(ROWS).count();
    expect(withMin).toBeLessThan(12);

    await boxes.nth(0).fill('');
    await expect(page.locator(ROWS)).toHaveCount(12);
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

    /*
     * `toHaveCount` and not `count()`: the first retries until the table has
     * rendered and the second reads whatever is there at that instant, which
     * on a lazily routed page is nothing. It cost a red test to remember.
     */
    await expect(page.locator(`${DEMO} ewms-badge`)).toHaveCount(12);

    // Every tinted row carries a badge with an icon and a label: the colour is
    // never the only signal (WCAG 1.4.1).
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

    // One cell across the whole table, with content of the consumer's own.
    await expect(panel.locator('td')).toHaveCount(1);
    await expect(panel).toContainText('Bultos totales');

    // The table did not grow: the panel is a row in the DOM, not an
    // expedición. Counting it would make three read as four out loud.
    await expect(page.locator(`${DETALLE} table`)).toHaveAttribute('aria-rowcount', '12');
  });

  test('the toggle says on the BUTTON what it opened', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    const button = page.locator(`${DETALLE} [data-detail-toggle="0"] button`);
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    const id = await page.locator(`${DETALLE} [data-detail="0"] td`).getAttribute('id');
    await expect(button).toHaveAttribute('aria-controls', id ?? '');
  });

  test('the row menu opens from the kebab and from the right button', async ({ page }) => {
    await page.goto(TABLE);
    await ready(page);

    await page.locator(`${DETALLE} [data-kebab="0"] button`).click();
    await expect(page.locator('[role="menu"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="menu"]')).toHaveCount(0);

    // A trackpad has no right button and a phone has none either, which is why
    // the kebab exists; everybody who does have one expects it to work.
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
    // Imprimir is disabled, so the second press lands on Duplicar. Asserted
    // through a retrying locator rather than by reading the attribute: a bare
    // getAttribute reads whatever is there at that instant, which with
    // zoneless change detection is the value before the press landed.
    const active = menu.locator('[role="menuitem"].bg-ghost-hover');
    await expect(active).toContainText('Duplicar');
    await expect(menu).toHaveAttribute(
      'aria-activedescendant',
      (await active.getAttribute('id')) ?? '',
    );

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
    // The expedición with an incidencia is the one whose children never come.
    const failing = page.locator(`${demo} tr.bg-danger-surface`).first();
    const index = await failing.getAttribute('data-row');

    await page.locator(`${demo} [data-toggle="${index}"]`).click();
    await expect(page.locator(`${demo} [data-loading="${index}"]`)).toBeVisible();
    await expect(page.locator(`${demo} [data-failed="${index}"]`)).toBeVisible();
    await expect(page.locator(`${demo} [data-retry="${index}"]`)).toBeVisible();
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

    // The window: what is drawn is what fits plus the overscan, and never the
    // five thousand. This is the whole claim of [virtual].
    const drawn = page.locator(`${VIRTUAL} [data-row]`);
    expect(await drawn.count()).toBeLessThan(80);
    expect(await drawn.count()).toBeGreaterThan(0);

    // The spacers hold the scrollbar at the length of the whole table.
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

    // Row one thousand, by the sm row height, less the overscan. What matters
    // is that the first drawn row is nowhere near zero and that its
    // aria-rowindex is its place in the WHOLE table.
    const first = page.locator(`${VIRTUAL} [data-row]`).first();
    await expect(first).not.toHaveAttribute('data-row', '0');
    const index = Number(await first.getAttribute('data-row'));
    await expect(first).toHaveAttribute('aria-rowindex', String(index + 1));
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

    // Twenty-five per page, and the page really changed underneath.
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
    // A source that does not count says nothing about how many there are.
    await expect(page.locator(demo)).not.toContainText('filas');
  });

  test('a filter field IS a compact row tall, and a narrow range stacks', async ({ page }) => {
    /*
     * A WIDER VIEWPORT THAN THE DEFAULT, AND THE REASON IS THE APP SHELL.
     *
     * What is under test is the COMPONENT's rule: an `md` column fits two
     * boxes side by side and an `sm` one stacks them. From DS-5 the catalogue
     * renders inside the App Shell, whose rail takes 232 px of the width, and
     * at 1280 the date column stopped being wide enough -- so the date range
     * stacked too and the test failed having proved the component right.
     *
     * Giving it the room the assertion is about is not weakening it: the
     * stacking half is asserted on the SAME page at the SAME width, on a
     * column that is narrow by declaration rather than by accident.
     */
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(TABLE);
    await ready(page);

    const filterRow = page.locator('[data-demo-table] [data-filter-row]');

    /*
     * The filter row holds real `ewms-input`s in the Small size, and Small is
     * the same token as the compact row: `--row-height-sm`. That is the point
     * of the pair -- a field dropped into a cell is exactly a row tall, so
     * nothing has to be nudged to make it fit.
     */
    const single = filterRow.locator('[data-filter="cliente"] input');
    await expect(single).toBeVisible();
    expect(round((await single.boundingBox())?.height)).toBe(32);

    // A `md` column is wide enough for two boxes side by side.
    const wideRange = filterRow.locator('[data-filter="fecha"] input');
    await expect(wideRange).toHaveCount(2);
    expect(round((await wideRange.nth(0).boundingBox())?.y)).toBe(
      round((await wideRange.nth(1).boundingBox())?.y),
    );

    /*
     * A `sm` one is not, and the two boxes STACK rather than shrink. They used
     * to shrink: in the first capture of the big table the two markers read
     * "D" and "H", which is a filter nobody can tell apart. The column width
     * is a preference; legibility is not, and a taller filter row is the
     * cheaper of the two prices.
     */
    const narrowRange = filterRow.locator('[data-filter="bultos"] input');
    await expect(narrowRange).toHaveCount(2);
    expect(round((await narrowRange.nth(1).boundingBox())?.y)).toBeGreaterThan(
      round((await narrowRange.nth(0).boundingBox())?.y) ?? 0,
    );
  });
});
