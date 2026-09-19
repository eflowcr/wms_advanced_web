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

const BUTTON = '/design-system/components/button';
const SPACING = '/design-system/foundations/spacing';
const TEXT = '/design-system/components/text';
const ICON_BUTTON = '/design-system/components/icon-button';
const TOOLTIP = '/design-system/components/tooltip';
const INPUT = '/design-system/components/input';
const SELECT = '/design-system/components/select';
const CHECKBOX = '/design-system/components/checkbox';
const RADIO = '/design-system/components/radio';
const TOGGLE = '/design-system/components/toggle';

/**
 * Every navigable route. Fifteen since DS-2 PR 4: the seven of PR 3 plus one
 * sheet per built component, which is what "nothing built is undocumented"
 * looks like when it is a test rather than a promise.
 */
const PAGES = [
  { url: '/design-system', heading: 'Showroom del sistema de diseño' },
  { url: '/design-system/foundations/brand', heading: 'Marca' },
  { url: '/design-system/foundations/colors', heading: 'Color' },
  { url: '/design-system/foundations/typography', heading: 'Tipografía' },
  { url: SPACING, heading: 'Espaciado, radios y elevación' },
  { url: '/design-system/foundations/icons', heading: 'Iconografía' },
  { url: BUTTON, heading: 'Botón' },
  { url: TEXT, heading: 'Texto' },
  { url: ICON_BUTTON, heading: 'Icon Button' },
  { url: TOOLTIP, heading: 'Tooltip' },
  { url: INPUT, heading: 'Input' },
  { url: SELECT, heading: 'Select / Dropdown' },
  { url: CHECKBOX, heading: 'Checkbox' },
  { url: RADIO, heading: 'Radio' },
  { url: TOGGLE, heading: 'Toggle' },
] as const;

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

    await search.fill('toggle');
    await expect(links).toHaveCount(1);

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
  test('the icon button is square at the three sizes, over the 2.5.8 minimum', async ({
    page,
  }) => {
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
    const thumb = await page
      .locator('[data-measure-track] span[aria-hidden="true"]')
      .boundingBox();
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
