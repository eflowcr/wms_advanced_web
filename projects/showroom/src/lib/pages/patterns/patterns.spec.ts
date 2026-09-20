import { DialogModule } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SCAN_THRESHOLD_TOKEN, ShortcutsHost } from '@ewms/design-system';
import { provideShowroomDesignSystem } from '../../showroom.providers';
import { ShowroomKeyboard } from './keyboard';
import { ShowroomSearchCreateEdit } from './search-create-edit';

/**
 * The two pattern pages, DRIVEN.
 *
 * `pages.spec.ts` renders every page and checks its structure; that is where
 * the eight blocks and the axe run live. What is here is the half that only
 * shows up when somebody USES the page: opening the form, saving, cancelling,
 * a scan arriving, a click being counted.
 *
 *
 * THE ENGINE IS REAL, AND THAT IS WHY THERE IS A HOST
 *
 * Both pages register actions on `KeyboardShortcuts`, and the engine only
 * dispatches once a root layout has mounted it -- which in the running
 * application is the shell's `MainLayout`. So the host below plays that part:
 * `ewmsShortcutsHost` on an element whose injector carries the showroom's own
 * map. Without it these tests would drive the pages with the keyboard
 * disconnected, which is the one thing they exist to exercise.
 *
 * The browser half -- how many clicks a flow really costs with a pointer --
 * needs a pointer, and lives in e2e/click-budget.e2e.ts.
 */

@Component({
  selector: 'ewms-patterns-test-host',
  imports: [ShortcutsHost, ShowroomSearchCreateEdit],
  template: `<div ewmsShortcutsHost><ewms-showroom-search-create-edit /></div>`,
  providers: [provideShowroomDesignSystem()],
})
class ScreenHost {}

@Component({
  selector: 'ewms-patterns-keyboard-host',
  imports: [ShortcutsHost, ShowroomKeyboard],
  template: `<div ewmsShortcutsHost><ewms-showroom-keyboard /></div>`,
  providers: [provideShowroomDesignSystem()],
})
class KeyboardHost {}

/** Everything the CDK's overlay left behind, which is where a dialog renders. */
function overlay(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function cleanUpOverlays(): void {
  for (const container of document.querySelectorAll('.cdk-overlay-container')) {
    container.remove();
  }
}

/**
 * The threshold, declared by hand because jsdom loads no stylesheet.
 *
 * `--threshold-scan-keystroke` lives in tokens.css, and with no stylesheet the
 * token reads as absent -- at which point NOTHING can be classified as a scan,
 * by design, and every scan case here would pass vacuously while testing the
 * absence of the token instead of the presence of a gun. Declaring it is the
 * same thing search-select.spec.ts does, for the same reason.
 */
const THRESHOLD_MS = 50;

describe('the DS-4 pattern pages, driven', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty(SCAN_THRESHOLD_TOKEN, `${THRESHOLD_MS}ms`);
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(SCAN_THRESHOLD_TOKEN);
    cleanUpOverlays();
  });

  async function mount<T>(host: new () => T): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [host, DialogModule],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(host);
    // In the document, so focus and the overlay have somewhere to live.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  }

  /**
   * One keystroke per character at gun speed, closed by Enter.
   *
   * SYNCHRONOUS, AND THAT IS WHAT MAKES IT DETERMINISTIC. Sleeping five
   * milliseconds between keys sounds more faithful and is not: on a loaded
   * test runner a five-millisecond sleep can take fifty, the run breaks, and
   * the case fails for a reason that has nothing to do with the code. Dispatched
   * in a tight loop the gaps are zero, which is under any threshold and is
   * exactly what the classifier is being asked about.
   */
  function scan(code: string): void {
    for (const char of code) {
      press(char);
    }
    press('Enter');
  }

  describe('buscar, crear, editar', () => {
    let fixture: ComponentFixture<ScreenHost>;
    let page: HTMLElement;

    beforeEach(async () => {
      fixture = await mount(ScreenHost);
      page = fixture.nativeElement as HTMLElement;
    });

    afterEach(() => {
      fixture.destroy();
      fixture.nativeElement.remove();
    });

    function query<T extends Element>(selector: string): T | null {
      return (page.querySelector<T>(selector) ??
        overlay()?.querySelector<T>(selector) ??
        null) as T | null;
    }

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('opens the form on Alt+N, without anybody clicking', async () => {
      press('n', { altKey: true });
      await settle();

      expect(query('[data-expedicion-form]')).not.toBeNull();
      expect(query('[data-click-count]')?.textContent?.trim()).toBe('0');
    });

    it('saves what the form holds, and says so with a toast', async () => {
      press('n', { altKey: true });
      await settle();

      const codigo = query<HTMLInputElement>('[data-form-codigo] input');
      codigo!.value = 'EXP-2026-0777';
      codigo!.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();

      query<HTMLButtonElement>('[data-form-save] button')!.click();
      await settle();

      expect(query('[data-expedicion-form]')).toBeNull();
      expect(query('[data-last-saved]')?.textContent?.trim()).toBe('EXP-2026-0777');
      // The new record went to the top of the table, which is what makes the
      // search that follows able to find it.
      expect(page.querySelector('tbody [role="row"]')?.textContent).toContain('EXP-2026-0777');
    });

    it('a record saved with nothing typed still gets a code and a client', async () => {
      // The empty-form arm: a demo screen must not put a blank row in a table.
      press('n', { altKey: true });
      await settle();
      query<HTMLButtonElement>('[data-form-save] button')!.click();
      await settle();

      expect(page.querySelector('tbody [role="row"]')?.textContent).toContain('EXP-2026-XXXX');
      expect(page.querySelector('tbody [role="row"]')?.textContent).toContain('Sin cliente');
    });

    it('cancelling changes nothing and asks nothing', async () => {
      press('n', { altKey: true });
      await settle();
      const codigo = query<HTMLInputElement>('[data-form-codigo] input');
      codigo!.value = 'no se guarda';
      codigo!.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();

      query<HTMLButtonElement>('[data-form-cancel] button')!.click();
      await settle();

      expect(query('[data-expedicion-form]')).toBeNull();
      expect(query('[data-last-saved]')?.textContent?.trim()).toBe('—');
      expect(query('ewms-confirm-dialog')).toBeNull();
    });

    it('Escape cancels too, and the form does not save on the way out', async () => {
      press('n', { altKey: true });
      await settle();

      const form = query('[data-expedicion-form]')!;
      press('Escape', {}, form);
      await settle();

      expect(query('[data-expedicion-form]')).toBeNull();
      expect(query('[data-last-saved]')?.textContent?.trim()).toBe('—');
    });

    it('Ctrl+S saves the open form from inside a field', async () => {
      press('n', { altKey: true });
      await settle();
      const codigo = query<HTMLInputElement>('[data-form-codigo] input');
      codigo!.value = 'EXP-2026-0778';
      codigo!.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();

      press('s', { ctrlKey: true }, codigo!);
      await settle();

      expect(query('[data-last-saved]')?.textContent?.trim()).toBe('EXP-2026-0778');
    });

    it('the form gives back `save` when it closes', async () => {
      // The registration lives as long as the dialog's injector and no longer,
      // which is what lets the screen behind it take the action back without
      // the two knowing about each other.
      press('n', { altKey: true });
      await settle();
      press('Escape', {}, query('[data-expedicion-form]')!);
      await settle();

      // Opening a second form must not throw "already registered".
      press('n', { altKey: true });
      await settle();

      expect(query('[data-expedicion-form]')).not.toBeNull();
    });

    it('a scan chooses the shipment, whole, without opening the panel', async () => {
      scan('EXP-2026-0403');
      await settle();

      expect(query('[data-chosen]')?.textContent).toContain('EXP-2026-0403');
      expect(query('[data-expedicion-form]')).toBeNull();
      expect(query('[data-click-count]')?.textContent?.trim()).toBe('0');
    });

    it('a scanned code nothing matches says so instead of choosing wrongly', async () => {
      scan('EXP-0000-9999');
      await settle();

      expect(query('[data-chosen]')?.textContent?.trim()).toBe('—');
    });

    it('editing offers the record that was chosen', async () => {
      scan('EXP-2026-0403');
      await settle();

      const edit = query<HTMLButtonElement>('[data-edit-button] button')!;
      expect(edit.disabled).toBe(false);
      edit.click();
      await settle();

      expect(query<HTMLInputElement>('[data-form-codigo] input')?.value).toBe('EXP-2026-0403');
    });

    it('editing rewrites the row rather than adding a second one', async () => {
      scan('EXP-2026-0403');
      await settle();
      query<HTMLButtonElement>('[data-edit-button] button')!.click();
      await settle();

      const cliente = query<HTMLInputElement>('[data-form-cliente] input')!;
      cliente.value = 'Cliente corregido';
      cliente.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      query<HTMLButtonElement>('[data-form-save] button')!.click();
      await settle();

      const rows = [...page.querySelectorAll('tbody [role="row"]')].map((row) => row.textContent);
      expect(rows.filter((text) => text?.includes('EXP-2026-0403')).length).toBe(1);
      expect(rows.some((text) => text?.includes('Cliente corregido'))).toBe(true);
    });

    /**
     * `element.click()` IS NOT A MOUSE CLICK, and since DS-5 the screen can
     * tell.
     *
     * A click synthesised by the DOM carries `detail === 0`, exactly like the
     * one a browser dispatches when somebody activates a control from the
     * keyboard -- and §2.1 of REQ-FE-DS4-003 scores a keyboard activation at
     * ZERO. The counter started ignoring those when `Enter` began submitting
     * the example form, because otherwise the screen charged a click for a
     * flow the standard says is free, and the screen would have been the one
     * lying.
     *
     * So this spec now presses the way a person does: with a real button.
     */
    function mouseClick(element: HTMLElement): void {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    }

    it('counts a click on a control, and ignores its own scaffolding', async () => {
      const count = (): string => query('[data-click-count]')!.textContent!.trim();

      mouseClick(query<HTMLButtonElement>('[data-new-button] button')!);
      await settle();
      expect(count()).toBe('1');

      // The reset and the failure switch are the demo talking about itself.
      mouseClick(query<HTMLButtonElement>('[data-reset-clicks]')!);
      await settle();
      expect(count()).toBe('0');

      mouseClick(query<HTMLButtonElement>('[data-toggle-failure]')!);
      await settle();
      expect(count()).toBe('0');
    });

    it('a KEYBOARD activation costs nothing, which is what the standard says', async () => {
      const count = (): string => query('[data-click-count]')!.textContent!.trim();

      // `detail: 0` is what a browser dispatches when Enter or Space activates
      // a control. §2.1: "Tab, flechas y Enter para recorrer y activar" = 0.
      query<HTMLButtonElement>('[data-new-button] button')!.click();
      await settle();

      expect(count()).toBe('0');
    });

    it('a broken source is a banner, because the condition stays true', async () => {
      expect(page.querySelector('ewms-banner')).toBeNull();

      query<HTMLButtonElement>('[data-toggle-failure]')!.click();
      await settle();

      expect(page.querySelector('ewms-banner')).not.toBeNull();
      // And it can be put back, which is what makes the switch a demonstration
      // rather than a one-way door.
      query<HTMLButtonElement>('[data-toggle-failure]')!.click();
      await settle();
      expect(page.querySelector('ewms-banner')).toBeNull();
    });

    it('the search source answers, and a result can be chosen from the panel', async () => {
      /*
       * The only case that drives `ExpedicionSource` end to end -- a scan
       * resolves against the rows in memory and never asks the source, so
       * without this the demo's whole data path would be untested.
       */
      const field = page.querySelector<HTMLInputElement>('[data-search-host] input')!;
      field.focus();
      field.value = 'textiles';
      field.dispatchEvent(new Event('input', { bubbles: true }));

      // Past the input delay and the source's own latency.
      await new Promise((resolve) => setTimeout(resolve, 700));
      await settle();

      // The panel is a CDK overlay, so it is NOT inside this component's tree.
      const option = query<HTMLElement>('[role="listbox"] [role="option"]');
      expect(option?.textContent).toContain('Textiles Sur');

      option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      option!.click();
      await settle();

      expect(query('[data-chosen]')?.textContent).toContain('Textiles Sur');
    });

    it('a source that refuses says so where the search is, not in a toast', async () => {
      query<HTMLButtonElement>('[data-toggle-failure]')!.click();
      await settle();

      const field = page.querySelector<HTMLInputElement>('[data-search-host] input')!;
      field.focus();
      field.value = 'textiles';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 700));
      await settle();

      /*
       * IN THE FLOW, NOT IN THE PANEL. The search select draws a failed query
       * under the field, with its retry one Tab away -- which is the whole
       * point of that decision, and is why this reads the component's own tree
       * rather than the overlay the results would have appeared in.
       */
      expect(page.querySelector('[data-search-host]')?.textContent).toContain(
        'No se pudo consultar',
      );
    });

    it('activating a row in the table opens it for editing', async () => {
      // Double click, which is the mouse half of `(rowActivate)` -- the other
      // half being Enter on the focused row.
      const row = page.querySelector<HTMLElement>('tbody [role="row"]')!;
      const codigo = row.textContent ?? '';
      row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();

      const opened = query<HTMLInputElement>('[data-form-codigo] input')?.value ?? '';
      expect(opened).not.toBe('');
      expect(codigo).toContain(opened);
    });

    it('the form carries the state and the urgent switch back out', async () => {
      press('n', { altKey: true });
      await settle();

      const estado = query<HTMLSelectElement>(
        '[data-form-estado] button, [data-form-estado] select',
      );
      expect(estado).not.toBeNull();

      const urgente = query<HTMLInputElement>('[data-form-urgente] input')!;
      urgente.click();
      await settle();
      expect(urgente.checked).toBe(true);

      const codigo = query<HTMLInputElement>('[data-form-codigo] input')!;
      codigo.value = 'EXP-2026-0779';
      codigo.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();

      query<HTMLButtonElement>('[data-form-save] button')!.click();
      await settle();

      expect(query('[data-last-saved]')?.textContent?.trim()).toBe('EXP-2026-0779');
    });

    it('a scan INTO the field is resolved by the field, against the record code', async () => {
      /*
       * The other half of the scan story, and the one DS-3 built: with the
       * focus in the search select, the FIELD classifies the burst and matches
       * it against `display.code`. The screen's own subscription handles the
       * case where the gun is fired with the focus nowhere -- both exist, and
       * a warehouse hits both.
       */
      const field = page.querySelector<HTMLInputElement>('[data-search-host] input')!;
      field.focus();
      for (const char of 'EXP-2026-0403') {
        field.value += char;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        press(char, {}, field);
      }
      press('Enter', {}, field);
      await new Promise((resolve) => setTimeout(resolve, 700));
      await settle();

      expect(query('[data-chosen]')?.textContent).toContain('EXP-2026-0403');
    });

    it('a browser that submits the form implicitly saves it, like Guardar does', async () => {
      /*
       * `ewms-button` renders `type="button"` unconditionally, so this form has
       * no submit button and no browser reaches this listener today. It is
       * wired anyway, because a <form> that quietly did nothing on submit is a
       * trap for whoever adds a single-field version of it later -- and the
       * only honest way to keep a wire live is to exercise it.
       */
      press('n', { altKey: true });
      await settle();
      const codigo = query<HTMLInputElement>('[data-form-codigo] input')!;
      codigo.value = 'EXP-2026-0780';
      codigo.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();

      query('[data-expedicion-form]')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await settle();

      expect(query('[data-last-saved]')?.textContent?.trim()).toBe('EXP-2026-0780');
    });

    it('the state can be changed from the select, and comes back with the record', async () => {
      press('n', { altKey: true });
      await settle();

      query<HTMLButtonElement>('[data-form-estado] button')!.click();
      await settle();
      const options = [...(overlay()?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const completada = options.find((option) => option.textContent?.includes('Completada'));
      expect(completada).toBeDefined();
      completada!.click();
      await settle();

      const codigo = query<HTMLInputElement>('[data-form-codigo] input')!;
      codigo.value = 'EXP-2026-0781';
      codigo.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      query<HTMLButtonElement>('[data-form-save] button')!.click();
      await settle();

      expect(page.querySelector('tbody [role="row"]')?.textContent).toContain('Completada');
    });

    it('`/` puts the focus in the search field and costs nothing', async () => {
      press('/');
      // The engine defers a single-character shortcut by one threshold window.
      await new Promise((resolve) => setTimeout(resolve, THRESHOLD_MS * 3));
      await settle();

      expect(page.querySelector('[data-search-host]')?.contains(document.activeElement)).toBe(true);
      expect(query('[data-click-count]')?.textContent?.trim()).toBe('0');
    });
  });

  describe('atajos de teclado', () => {
    let fixture: ComponentFixture<KeyboardHost>;
    let page: HTMLElement;

    beforeEach(async () => {
      fixture = await mount(KeyboardHost);
      page = fixture.nativeElement as HTMLElement;
    });

    afterEach(() => {
      fixture.destroy();
      fixture.nativeElement.remove();
    });

    async function settle(): Promise<void> {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('lists the map the engine is really dispatching from', async () => {
      await settle();
      const actions = [...page.querySelectorAll('[data-demo-bindings] th')].map((cell) =>
        cell.textContent?.trim(),
      );

      expect(actions).toEqual(['search', 'create', 'save', 'cancel', 'help']);
      expect(page.textContent).not.toContain('Ningún layout raíz montó el motor');
    });

    it('classifies an ordinary key, and says what it decided', async () => {
      press('q');
      await settle();

      const log = page.querySelector('[data-demo-log]')?.textContent ?? '';
      expect(log).toContain('key');
      expect(log).toContain('Tecla normal');
    });

    it('classifies a whole scan, and no key of it as a shortcut', async () => {
      scan('EXP-000123');
      await settle();

      expect(page.querySelector('[data-demo-last-scan]')?.textContent?.trim()).toBe('EXP-000123');
      const log = page.querySelector('[data-demo-log]')?.textContent ?? '';
      expect(log).toContain('scan');
      expect(log).toContain('burst');
      expect(page.querySelector('[data-demo-search-hits]')?.textContent?.trim()).toBe('0');
    });

    it('counts the shortcuts it registered, and only after the deferral', async () => {
      press('/');
      await settle();
      // Still waiting: a gun that started with `/` would arrive about now.
      expect(page.querySelector('[data-demo-search-hits]')?.textContent?.trim()).toBe('0');

      await new Promise((resolve) => setTimeout(resolve, THRESHOLD_MS * 3));
      await settle();
      expect(page.querySelector('[data-demo-search-hits]')?.textContent?.trim()).toBe('1');

      press('n', { altKey: true });
      await settle();
      expect(page.querySelector('[data-demo-create-hits]')?.textContent?.trim()).toBe('1');
    });

    it('shows `unregistered` for an action nobody answered', async () => {
      // `save` is deliberately left unregistered on this page, so the outcome
      // can be seen rather than only described.
      press('s', { ctrlKey: true });
      await settle();

      expect(page.querySelector('[data-demo-log]')?.textContent).toContain('unregistered');
    });

    it('clears everything it collected', async () => {
      scan('EXP-000123');
      await settle();
      expect(page.querySelector('[data-demo-log] tr')).not.toBeNull();

      page.querySelector<HTMLButtonElement>('[data-demo-keyboard] button')!.click();
      await settle();

      expect(page.querySelector('[data-demo-last-scan]')?.textContent?.trim()).toBe('—');
      expect(page.querySelector('[data-demo-search-hits]')?.textContent?.trim()).toBe('0');
      expect(page.querySelector('[data-demo-log]')?.textContent).toContain('Todavía no llegó');
    });

    it('prints a space as a word, so an empty cell never means "nothing arrived"', async () => {
      press(' ');
      await settle();

      expect(page.querySelector('[data-demo-log]')?.textContent).toContain('Space');
    });
  });
});
