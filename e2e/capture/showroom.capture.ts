import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/**
 * Renders every showroom route, captures it, and writes down what it measured.
 * See playwright.capture.config.ts for why this is a rig and not a test.
 */

const OUT = path.resolve('showroom-captures');

const ROUTES = [
  { name: '01-home', url: '/design-system' },
  { name: '02-foundations-brand', url: '/design-system/foundations/brand' },
  { name: '03-foundations-colors', url: '/design-system/foundations/colors' },
  { name: '04-foundations-typography', url: '/design-system/foundations/typography' },
  { name: '05-foundations-spacing', url: '/design-system/foundations/spacing' },
  { name: '06-foundations-icons', url: '/design-system/foundations/icons' },
  { name: '07-components-button', url: '/design-system/components/button' },
  { name: '08-components-text', url: '/design-system/components/text' },
  { name: '09-components-icon-button', url: '/design-system/components/icon-button' },
  { name: '10-components-tooltip', url: '/design-system/components/tooltip' },
  { name: '11-components-input', url: '/design-system/components/input' },
  { name: '12-components-select', url: '/design-system/components/select' },
  { name: '13-components-checkbox', url: '/design-system/components/checkbox' },
  { name: '14-components-radio', url: '/design-system/components/radio' },
  { name: '15-components-toggle', url: '/design-system/components/toggle' },
  { name: '16-components-banner', url: '/design-system/components/banner' },
  { name: '17-components-toast', url: '/design-system/components/toast' },
  { name: '18-components-card', url: '/design-system/components/card' },
  { name: '19-components-dialog', url: '/design-system/components/dialog' },
  { name: '20-components-search-select', url: '/design-system/components/search-select' },
] as const;

/**
 * The first capture lies if the fallback face is still on screen: every width
 * measured under it is wrong. `document.fonts.ready` alone is not enough — it
 * resolves without downloading a weight nothing has painted yet, and these
 * pages paint 400 through 700.
 */
async function waitForMontserrat(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      [400, 500, 600, 700].map((weight) => document.fonts.load(`${weight} 1rem Montserrat`)),
    );
    await document.fonts.ready;
  });
  const ready = await page.evaluate(() => document.fonts.check('700 1rem Montserrat'));
  expect(ready, 'Montserrat must be loaded before anything is captured or measured').toBe(true);
}

interface Measured {
  readonly name: string;
  readonly box: string;
  readonly styles: Readonly<Record<string, string>>;
}

/**
 * Everything the pages tagged with `data-measure`, with the geometry and the
 * computed properties that come from tokens. Reading them back out of the
 * browser is the only way to know a token actually applied.
 */
async function measure(page: Page): Promise<readonly Measured[]> {
  return page.evaluate(() => {
    const PROPERTIES = [
      'font-family',
      'font-size',
      'font-weight',
      'line-height',
      'color',
      'background-color',
      'border-color',
      'border-width',
      'border-radius',
      'box-shadow',
      'padding',
      'gap',
      'outline-color',
    ];
    return [...document.querySelectorAll('[data-measure]')].map((element) => {
      const rect = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      const styles: Record<string, string> = {};
      for (const property of PROPERTIES) {
        const value = computed.getPropertyValue(property).trim();
        if (value && value !== 'none' && value !== 'normal' && value !== '0px') {
          styles[property] = value;
        }
      }
      return {
        name: element.getAttribute('data-measure') ?? '(unnamed)',
        box: `${rect.width.toFixed(2)} x ${rect.height.toFixed(2)}`,
        styles,
      };
    });
  });
}

/** Horizontal scroll is a defect, so the rig reports it per width. */
async function overflow(page: Page, width: number): Promise<string> {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  return result.scroll > result.client
    ? `OVERFLOW at ${width}: scrollWidth ${result.scroll} > clientWidth ${result.client}`
    : `ok at ${width}`;
}

/**
 * Tabs until the wanted element holds focus. Calling .focus() would not do:
 * `:focus-visible` is the browser's own decision and it only grants the ring
 * when focus arrived from the keyboard, which is the state worth looking at.
 */
async function focusByTabbing(page: Page, selector: string, maxTabs = 80): Promise<boolean> {
  /*
   * Blur, do not click. Clicking the page to "reset" focus put the pointer on
   * the shell header's first link, the app navigated away, and every walk
   * after that was tabbing around the home page wondering why the button was
   * missing. Blurring drops the sequential-navigation starting point without
   * touching anything.
   */
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(
      (target) => Boolean(document.activeElement?.closest(target)),
      selector,
    );
    if (hit) {
      return true;
    }
  }
  return false;
}

function render(title: string, rows: readonly Measured[]): string {
  const lines = [`\n===== ${title} =====`];
  if (rows.length === 0) {
    lines.push('  (nothing tagged with data-measure)');
  }
  for (const row of rows) {
    lines.push(`  ${row.name}`);
    lines.push(`    box: ${row.box}`);
    for (const [property, value] of Object.entries(row.styles)) {
      lines.push(`    ${property}: ${value}`);
    }
  }
  return lines.join('\n');
}

const report: string[] = [];

test.describe('showroom capture rig', () => {
  test.beforeAll(async () => {
    await mkdir(OUT, { recursive: true });
  });

  test.afterAll(async () => {
    await writeFile(path.join(OUT, 'measurements.txt'), `${report.join('\n')}\n`, 'utf8');
  });

  for (const route of ROUTES) {
    test(`captures ${route.name}`, async ({ page }) => {
      await page.goto(route.url);
      await waitForMontserrat(page);
      await page.waitForTimeout(250);

      await page.screenshot({ path: path.join(OUT, `${route.name}.png`), fullPage: true });

      report.push(render(`${route.name} (${route.url})`, await measure(page)));
      report.push(`  ${await overflow(page, 1440)}`);
      report.push(`  ${await overflow(page, 1280)}`);
      // Leave the viewport where the next capture expects it.
      await page.setViewportSize({ width: 1440, height: 900 });
    });
  }

  test('captures the states nothing shows on its own', async ({ page }) => {
    await page.goto('/design-system/components/button');
    await waitForMontserrat(page);

    // A control focused from the keyboard on both grounds: the 2px gap inside
    // --focus-ring-shadow is painted with --color-surface, so the canvas is
    // where it can go wrong.
    const focusedOnCanvas = await focusByTabbing(page, '[data-focus-canvas]');
    expect(focusedOnCanvas, 'the canvas focus sample must be reachable by Tab').toBe(true);
    await page.screenshot({ path: path.join(OUT, '20-focus-on-canvas.png') });

    const focusedOnSurface = await focusByTabbing(page, '[data-focus-surface]');
    expect(focusedOnSurface, 'the surface focus sample must be reachable by Tab').toBe(true);
    await page.screenshot({ path: path.join(OUT, '21-focus-on-surface.png') });

    // Loading returns to Default on its own, so the shot has to be taken while
    // it is still spinning.
    await page.locator('[data-demo-submit] button').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '22-button-loading.png') });
    report.push(render('button page, loading', await measure(page)));

    // The tooltip, opened from the keyboard.
    const tooltipFocused = await focusByTabbing(page, '[data-demo-tooltip]');
    expect(tooltipFocused, 'the tooltip sample must be reachable by Tab').toBe(true);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '23-tooltip-open.png') });

    // The Select panel. The CDK overlay CSS landed in PR 2 and nothing ever
    // rendered with it: this is the first time that code runs in a browser.
    await page.goto('/design-system/foundations/spacing');
    await waitForMontserrat(page);
    await page.locator('[data-demo-select] button').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '24-select-open.png') });
    report.push(render('spacing page, select open', await measure(page)));

    /*
     * The Select's own sheet, with its panel up. A capture of a closed select
     * is a capture of an input with a chevron, so the one shot that matters on
     * that page is this one -- and it is the shot the ROUTES loop above cannot
     * take, because nothing on a freshly loaded page is open.
     */
    await page.goto('/design-system/components/select');
    await waitForMontserrat(page);
    await page.locator('[data-demo-select] button').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '25-select-page-open.png') });

    // The Select panel near the bottom edge, where it has to flip upwards.
    await page.locator('[data-demo-select]').evaluate((el) => {
      const style = (el as HTMLElement).style;
      style.position = 'fixed';
      style.zIndex = '1';
      style.left = '40px';
      style.top = 'calc(100vh - 90px)';
      style.width = '320px';
    });
    await page.locator('[data-demo-select] button').first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, '26-select-flipped.png') });

    /*
     * The tooltip sheet, opened from the keyboard, on its own page. The panel
     * is an overlay: it is absent from every full-page shot the loop takes.
     */
    await page.goto('/design-system/components/tooltip');
    await waitForMontserrat(page);
    const sheetTooltip = await focusByTabbing(page, '[data-demo-describes]');
    expect(sheetTooltip, 'the descriptive tooltip host must be reachable by Tab').toBe(true);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '27-tooltip-page-open.png') });

    // The four placements, one at a time, since only one tooltip exists at once.
    for (const position of ['top', 'bottom', 'left', 'right'] as const) {
      await page.locator(`[data-position-sample="${position}"] button`).hover();
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(OUT, `28-tooltip-${position}.png`) });
    }

    // The Input's password field with its value revealed, which no full-page
    // shot reaches either: it needs a click on the suffix button.
    await page.goto('/design-system/components/input');
    await waitForMontserrat(page);
    await page.getByRole('button', { name: 'Mostrar la clave' }).first().click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, '29-input-password-shown.png') });
    report.push(render('input page, password revealed', await measure(page)));
  });
});
