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
 * The document number is five, and the three extra stops are the shell's
 * PROVISIONAL header -- `Home`, `Design system` and the language switcher.
 * Replacing that header is the App Shell, DS-5, which this work explicitly
 * does not build. So the number is asserted as measured rather than as
 * wished: it cannot get worse without this failing, and the gap between five
 * and the three the comanda asks for is reported, not papered over.
 */
const TABS_TO_SEARCH_IN_DOCUMENT = 5;
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
      inShowroom: !el.closest('.app-layout__header'),
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
   * The sidebar must not be a wall you tab through to reach the search. The
   * search sits ABOVE the catalogue links for exactly this reason, so the
   * only stops before it are the shell's provisional header.
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

    // From the top of the document, shell header included.
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
