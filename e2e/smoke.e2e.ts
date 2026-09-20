import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { KEYBOARD, PAGES, SEARCH_CREATE_EDIT } from './routes';

/**
 * THE FLOOR OF THE SUITE. It runs on every pull request and every push, and it
 * has two minutes to answer one question: is the application alive, and do the
 * patterns it is built on still work?
 *
 * WHAT BELONGS HERE, AND WHAT DOES NOT. A test earns its place in `smoke` when
 * its failure means nobody can use the application -- it does not boot, a route
 * 404s, the keyboard path through a pattern is broken. A test that proves a
 * component sheet documents itself correctly is `showroom`: valuable, and not
 * worth paying for on a pull request that only touched `projects/core/`.
 *
 * ONE FLOW PER PATTERN, ON THE KEYBOARD. Not the whole matrix -- that is
 * `click-budget.e2e.ts`, which stays in `showroom`. The keyboard path is the
 * one chosen because it is the operator's path: gloves on, a gun in one hand,
 * and by REQ-FE-DS4-003 §2.1 it is the one that costs nothing.
 *
 * The cap is twelve tests. It is not arbitrary: a floor that grows becomes a
 * suite, and then it needs a floor of its own.
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

  /**
   * EVERY ROUTE, IN ONE TEST AND NOT ONE TEST EACH.
   *
   * `showroom` already spends a test per page on what each page owes -- its
   * heading, no sideways scroll, axe, the Tab walk. What `smoke` needs is
   * narrower and has to be cheap: does the route ANSWER? Twenty-four separate
   * tests would each pay for a fresh browser context to learn the same thing.
   *
   * The list is imported, so a route added to the catalogue is walked here
   * without anybody remembering to.
   */
  test('every route in the catalogue answers', async ({ page }) => {
    for (const { url, heading } of PAGES) {
      const response = await page.goto(url);
      expect(response?.status(), `${url} no respondió`).toBeLessThan(400);
      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
        `${url} no renderizó su h1`,
      ).toBeVisible();
    }
  });
});

test.describe('the patterns still work, on the keyboard', () => {
  /**
   * Buscar -> crear -> editar, the three flows of the comanda's step 5, in one
   * pass and without touching the mouse. What it defends is the WIRING: the
   * shortcut engine reaches the screen, the search select answers, the dialog
   * opens focused, and Ctrl+S saves the form instead of the browser's page.
   */
  test('buscar, crear y editar, sin tocar el ratón', async ({ page }) => {
    await page.goto(SEARCH_CREATE_EDIT);
    await expect(page.getByRole('heading', { level: 1, name: 'Buscar, crear, editar' })).toBeVisible();

    /*
     * CREAR FIRST, AND THE ORDER IS THE POINT rather than a convenience.
     *
     * `Alt+N` deliberately does NOT fire inside a text field (REQ-FE-DS4-001
     * PACQ-02.5), and choosing a result leaves the focus back in the search
     * box. Searching first and then creating would therefore fail -- correctly.
     * So the walk runs in the order the engine allows, which is also the order
     * somebody works in: make one, then find one, then change it.
     */
    await page.keyboard.press('Alt+n');
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
    await page.keyboard.type('EXP-2026-0990');
    await page.keyboard.press('Control+s');
    await expect(page.locator('[data-last-saved]')).toHaveText('EXP-2026-0990');

    // Buscar: `/` takes the focus to the search field from anywhere on screen.
    await page.keyboard.press('/');
    await expect(page.locator('[data-search-host] input')).toBeFocused();
    // The record just saved is the chosen one and its name is in the field.
    // Select-all before typing, so the query replaces it rather than trailing
    // it -- the same gesture a person makes, and still no mouse.
    await page.keyboard.press('Control+a');
    await page.keyboard.type('textiles');
    await expect(page.locator('[role="listbox"] [role="option"]').first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-chosen]')).toContainText(KNOWN_CODE);

    // Editar: the one just found, opened for editing.
    await page.locator('[data-edit-button] button').press('Enter');
    await expect(page.locator('[data-form-codigo] input')).toHaveValue(KNOWN_CODE);

    // Cancelar: Escape, always, and it asks nothing.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
  });

  /**
   * The scanner, which is the pattern that costs most if it breaks: a barcode
   * reader presents itself as a keyboard, so a naive shortcut fires in the
   * middle of a scan -- and on a receiving dock that is a wrong inventory
   * movement, not an interface annoyance. The exhaustive cases live in
   * `showroom`; what `smoke` keeps is the one that cannot be caught by
   * counting keystrokes: a code that BEGINS with a shortcut character.
   */
  test('un escaneo que empieza por una tecla de atajo no dispara nada', async ({ page }) => {
    await page.goto(KEYBOARD);
    await page.getByRole('heading', { level: 1, name: 'Atajos de teclado' }).click();

    await page.keyboard.type(`/${KNOWN_CODE}`, { delay: 5 });
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

/**
 * THE APP SHELL (DS-5), and specifically the four things a browser has to
 * answer and jsdom cannot: where the focus goes, what the document title says,
 * whether the header scrolls sideways at 375 px, and whether the bottom bar
 * really replaces the rail.
 *
 * `MainLayout` has NO unit spec, and that is a decision rather than a gap: a
 * jsdom render of it would raise a coverage percentage and check none of this.
 */
test.describe('the App Shell', () => {
  test('the first Tab is the skip link, and it lands the focus on <main>', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // WCAG 2.4.1. With a menu of sixteen destinations, a keyboard user
    // without this pays the whole navigation on every screen.
    await page.keyboard.press('Tab');
    const skip = page.locator('[data-skip-link]');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    /*
     * `main`, AND NOT THE HEADING, and the difference is what makes the link
     * worth having. The skip link's job is "tab on from here", so it has to
     * land at the START of the content: on the showroom the heading sits after
     * that page's own sidebar, and landing on it would take you PAST the
     * search you were skipping to. Naming where you are is the ROUTE CHANGE's
     * job, asserted separately below.
     */
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('`/` lands in the header search from a screen that did not claim it', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-page-heading]').click();

    await page.keyboard.press('/');

    // The other half of the "five tabs to the search" gap DS-2 reported: the
    // skip link is one, and this is zero.
    await expect(page.locator('[data-shell-search]')).toBeFocused();
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

    /*
     * AND THE ROUTE CHANGE SAID SO. A browser announces a page change because
     * the document was replaced; a single-page application replaces nothing,
     * so without the live region a screen reader says nothing at all when a
     * menu item is pressed. The focus moving to the heading is the other half,
     * asserted below after the close.
     */
    await expect(page.locator('[data-route-announce]')).toHaveText(/Lotes|Lots/);

    // Delete, from the keyboard, on the tab that is showing.
    await page.locator('[data-tab][aria-selected="true"]').press('Delete');

    await expect(tabs).toHaveCount(3);
    // The neighbour, not the first: closing the fourth of four and landing on
    // the dashboard is a jump nobody asked for.
    await expect(page.locator('[data-tab][aria-selected="true"]')).toHaveText(/Clientes|Customers/);
    // And the focus followed the navigation, onto the new page's heading.
    await expect(page.locator('[data-page-heading]')).toBeFocused();
  });

  test('a menu entry with no screen is a PAGE, never a 404', async ({ page }) => {
    const response = await page.goto('/catalogos/transportistas');

    expect(response?.status()).toBeLessThan(400);
    // `[data-page-heading]` and not `main h1`: the host page carries a second,
    // hidden `<main>` -- the startup-failure notice -- and a `main h1` locator
    // matches its heading too.
    await expect(page.locator('[data-page-heading]')).toBeVisible();
    await expect(page).toHaveTitle(/Transportistas|Carriers/);
  });

  test('at 375 px the rail becomes the bottom bar, and the header does not scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await expect(page.locator('ewms-nav-rail')).toHaveCount(0);
    await expect(page.locator('[data-nav-bottom]')).toBeVisible();

    // The header is the one piece of chrome that must never scroll sideways.
    const header = page.locator('[data-app-header]');
    const overflow = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'la cabecera se desborda a 375 px').toBeLessThanOrEqual(0);

    // The sheet traps the focus, and Escape gives it back (decisión del
    // usuario 2026-09-19: bottom bar, and this is the part that is not
    // negotiable whichever shape the navigation takes).
    const more = page.locator('[data-nav-bottom-more]');
    await more.click();
    const sheet = page.locator('[data-nav-bottom-sheet]');
    await expect(sheet).toBeVisible();
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(more).toBeFocused();
  });

  test('a favourite is ONE click from anywhere, and is lost on reload', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-nav-item="catalogs"]').click();
    await page.locator('[data-nav-item="articles"]').click();

    await page.locator('[data-app-header] [data-favorite-toggle] button').click();
    const entry = page.locator('ewms-nav-rail [data-favorite]');
    await expect(entry).toHaveCount(1);

    // From somewhere else, one click.
    await page.locator('[data-nav-item="dashboard"]').click();
    await entry.click();
    await expect(page).toHaveURL(/\/catalogos\/articulos$/);

    /*
     * AND THE LIMITATION, ASSERTED RATHER THAN HIDDEN (REQ-FE-DS4-002 v1.2,
     * PACQ-01.5). The list lives in memory: no browser storage anywhere in
     * this application, and no ESLint exception opened for favourites. The day
     * somebody connects the Security Core's preferences endpoint, THIS TEST
     * FAILS -- which is exactly when the documents have to be rewritten.
     */
    await page.reload();
    await expect(page.locator('ewms-nav-rail [data-favorite]')).toHaveCount(0);
    await expect(page.locator('ewms-nav-rail [data-favorites-empty]')).toBeVisible();
  });
});

/**
 * ONE axe SCAN, ON THE FRAME EVERY SCREEN RENDERS INSIDE.
 *
 * `showroom` scans all twenty-four pages; that is where a component's own
 * violations belong. What this one defends is the chrome -- the landmarks, the
 * skip link, the navigation, the tab strip -- because a violation there is on
 * every screen of the application at once.
 */
test('the application chrome has no axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'eWMS Advance' })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
