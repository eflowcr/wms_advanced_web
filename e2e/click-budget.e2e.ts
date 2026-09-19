import { expect, test, type Locator, type Page } from '@playwright/test';
/*
 * THE ONE DEEP IMPORT INTO projects/ IN THE WHOLE REPOSITORY, and the reason
 * it is not the @ewms/* alias.
 *
 * REQ-FE-DS4-003 HG-02 requires this test and the example screen to read the
 * four budgets from ONE file -- a test with the number typed into it agrees
 * with itself rather than with the standard. The alias resolves to the
 * showroom's public-api barrel, and importing that barrel from a Playwright
 * test loads the whole Angular library into Node: it fails before a single
 * test runs, with `PlatformLocation needs to be compiled using the JIT
 * compiler`. The budgets are four plain numbers in a file that imports
 * nothing; the barrel is the wrong road for them.
 *
 * The exception is this line and nothing else, and it does not weaken the
 * boundary it names: what stops a second copy of the numbers appearing is
 * tools/ci/check-click-budget.mjs, which also fails if this import goes away.
 */
// eslint-disable-next-line no-restricted-imports -- see the note above
import {
  CANCEL_MAX_CLICKS,
  CREATE_MAX_CLICKS,
  EDIT_MAX_CLICKS,
  SEARCH_MAX_CLICKS,
} from '../projects/showroom/src/lib/pages/patterns/click-budget';

/**
 * THE TEST THAT COUNTS (REQ-FE-DS4-003 RFE-03), and the keyboard rules that
 * only a real browser can answer (REQ-FE-DS4-001).
 *
 * THE NUMBERS ARE IMPORTED, NOT TYPED. They come from the same file the screen
 * reads, which is the whole of HG-02: a test with `toBeLessThanOrEqual(2)`
 * written into it agrees with itself rather than with the standard, and the
 * day §2.2 of the REQ changes, it would keep passing.
 *
 * WHY THE CLICKS ARE COUNTED BY A WRAPPER AND NOT READ OFF THE SCREEN. The
 * page counts its own clicks and shows the total, and reading that would be
 * the test trusting the thing under test. So `clicks()` wraps Playwright's own
 * `click` and counts the calls, and the two numbers are compared at the end --
 * if the page's counter and the test's disagree, one of them is lying and the
 * test says so.
 */

const SCREEN = '/design-system/patterns/search-create-edit';
const SCREEN_HEADING = 'Buscar, crear, editar';
const KEYBOARD = '/design-system/patterns/keyboard';

/** A shipment the seeded demo really holds, used by the scan and search cases. */
const KNOWN_CODE = 'EXP-2026-0403';

/** A counter around `locator.click()`. Keyboard actions deliberately never touch it. */
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

/** Zero the page's own counter without spending a click on doing so. */
async function resetPageCounter(page: Page): Promise<void> {
  // The button is marked `data-not-a-flow-click`, so it is not counted by the
  // page either -- but the test's own counter has no such marking, so the
  // reset goes through evaluate rather than through `clicks.click`.
  await page.locator('[data-reset-clicks]').evaluate((button: HTMLElement) => button.click());
  await expect(page.locator('[data-click-count]')).toHaveText('0');
}

async function pageCount(page: Page): Promise<number> {
  return Number((await page.locator('[data-click-count]').innerText()).trim());
}

async function open(page: Page): Promise<void> {
  await page.goto(SCREEN);
  await expect(page.getByRole('heading', { level: 1, name: SCREEN_HEADING })).toBeVisible();
  await resetPageCounter(page);
}

/**
 * The results of the SEARCH SELECT, and not every option in the document.
 *
 * `getByRole('option')` on its own also matches the shell's language
 * `<select>`, whose options are hidden -- so the bare locator waited five
 * seconds for a Spanish/English picker to become visible and then failed
 * talking about the wrong control. Scoping to the listbox is what makes the
 * failure message point at the thing under test.
 */
function results(page: Page): Locator {
  return page.locator('[role="listbox"] [role="option"]');
}

/**
 * Put the focus somewhere harmless inside the screen, without spending a click
 * on a control.
 *
 * The heading is not a control, so the page's own counter ignores it -- which
 * is what lets a scan case start from "the focus is nowhere in particular",
 * the state a gun is actually fired in.
 */
async function clickNeutral(page: Page): Promise<void> {
  await page.getByRole('heading', { level: 1, name: SCREEN_HEADING }).click();
}

/**
 * Type at the speed of a barcode reader and close with Enter.
 *
 * 5 ms a character, which is where an industrial gun actually sits, and well
 * under the 50 ms the token allows. This is the closest thing to a reader that
 * can be written down, and it is what every scan case below uses.
 */
async function scan(page: Page, code: string): Promise<void> {
  await page.keyboard.type(code, { delay: 5 });
  await page.keyboard.press('Enter');
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
    // Typing into the field the dialog already focused is zero, by §2.1.
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
    // §2.2: a screen that asks you to confirm cancelling something never saved
    // is spending the budget on a question.
    await expect(page.locator('ewms-confirm-dialog')).toHaveCount(0);
    await expect(page.locator('[data-last-saved]')).toHaveText('—');
    expect(clicks.total()).toBeLessThanOrEqual(CANCEL_MAX_CLICKS);
  });
});

/**
 * The same four flows, on the keyboard. EVERY ONE OF THEM MUST COST ZERO.
 *
 * Not an accounting trick: it is the point of the standard. The operator has
 * gloves on and a gun in one hand, and §2.1 rewards exactly that.
 */
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
    // The focus goes back where it came from, which is what makes Escape one
    // gesture rather than one gesture plus finding your place again.
    await expect(opener).toBeFocused();
    expect(clicks.total()).toBe(0);
    expect(await pageCount(page)).toBe(0);
  });
});

/**
 * RFE-05, on every surface, with a real gun's timing.
 *
 * This is the requirement whose failure costs a wrong inventory movement, so
 * it is asked on each surface separately rather than once somewhere
 * convenient.
 */
test.describe('a scan never fires a shortcut', () => {
  test('on the screen: it chooses the shipment without opening the panel', async ({ page }) => {
    await open(page);
    await clickNeutral(page);
    await resetPageCounter(page);

    await scan(page, KNOWN_CODE);

    await expect(page.locator('[data-chosen]')).toContainText(KNOWN_CODE);
    // Without the panel, and without a form having opened behind it.
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

    // `/` is the search shortcut and `?` opens the help. Both inside one code.
    await scan(page, 'AB/CD?EF12');

    await expect(page.locator('ewms-shortcut-help')).toHaveCount(0);
    await expect(page.locator('[data-expedicion-form]')).toHaveCount(0);
    await expect(page.locator('[data-search-host] input')).not.toBeFocused();
  });

  test('a code BEGINNING with a shortcut character fires nothing either', async ({ page }) => {
    /*
     * The case the length of the run cannot catch: at the first character
     * there is no run yet. What saves it is the engine waiting one threshold
     * window before acting on a single character.
     */
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

    // Read off the engine's own classification rather than inferred from a
    // side effect -- which is what `KeyboardShortcuts.events` exists for.
    await expect(page.locator('[data-demo-last-scan]')).toHaveText('EXP-000123');
    await expect(page.locator('[data-demo-log]')).toContainText('scan');
    await expect(page.locator('[data-demo-log]')).toContainText('burst');
    // Nothing was classified as a shortcut on the way through.
    await expect(page.locator('[data-demo-search-hits]')).toHaveText('0');
  });
});

/** RFE-04 and RFE-07, where they can only be answered by a real focus. */
test.describe('the shortcut rules, in a browser', () => {
  test('no shortcut fires inside a text field, and Escape still does', async ({ page }) => {
    await open(page);
    const field = page.locator('[data-search-host] input');
    await field.click();

    // Typed at human speed, so nothing here can be mistaken for a gun.
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

    // From INSIDE the field, which is where the focus is when somebody saves.
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

    // Every chord of the map, read off the map by the dialog itself.
    await expect(help.locator('kbd')).toHaveText(['/', 'Alt', 'N', 'Ctrl', 'S', 'Esc', '?']);

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

    // The ones with a modifier are untouched: 2.1.4 is about single characters.
    await page.keyboard.press('Alt+n');
    await expect(page.locator('[data-expedicion-form]')).toBeVisible();
  });
});
