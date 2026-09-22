import { DialogModule } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { SCAN_THRESHOLD_TOKEN } from './scan-detector';
import { ShortcutsHost } from './shortcuts-host';
import {
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SHORTCUT_MAP,
  type ShortcutHelpMessages,
  type ShortcutMap,
} from './shortcuts.types';

/**
 * Host real sobre documento real: las fallas de RFE-01 a RFE-05 son de foco y de evento.
 * El mapa es copia del del shell, para que cambiar una tecla rompa esta prueba.
 */

const MAP: ShortcutMap = {
  search: { key: '/', chord: ['/'] },
  create: { key: 'n', alt: true, chord: ['Alt', 'N'] },
  save: {
    key: 's',
    ctrl: true,
    preventDefault: true,
    insideTextFields: true,
    chord: ['Ctrl', 'S'],
  },
  cancel: { key: 'Escape', insideTextFields: true, chord: ['Esc'] },
  help: { key: '?', chord: ['?'] },
};

const MESSAGES: ShortcutHelpMessages = {
  title: 'Atajos de teclado',
  intro: 'Funcionan en toda la aplicación.',
  actionColumn: 'Acción',
  keyColumn: 'Tecla',
  close: 'Cerrar',
  singleKeyLabel: 'Atajos de una sola tecla',
  singleKeyHint: 'Se pueden disparar solos con entrada por voz.',
  singleKeyOff: '(apagado)',
  actions: {
    search: 'Buscar',
    create: 'Crear',
    save: 'Guardar',
    cancel: 'Cancelar',
    help: 'Abrir esta lista',
  },
};

const THRESHOLD = 50;

@Component({
  selector: 'ewms-shortcut-test-host',
  imports: [ShortcutsHost],
  template: `
    <div ewmsShortcutsHost>
      <input id="field" type="text" />
      <input id="box" type="checkbox" />
      <button id="elsewhere" type="button">elsewhere</button>
    </div>
  `,
  providers: [
    { provide: EWMS_SHORTCUT_MAP, useValue: MAP },
    { provide: EWMS_SHORTCUT_HELP_MESSAGES, useValue: MESSAGES },
  ],
})
class TestHost {
  readonly shortcuts = inject(KeyboardShortcuts);
}

describe('KeyboardShortcuts', () => {
  let fixture: ComponentFixture<TestHost>;
  let shortcuts: KeyboardShortcuts;
  let fired: string[];

  beforeEach(async () => {
    document.documentElement.style.setProperty(SCAN_THRESHOLD_TOKEN, `${THRESHOLD}ms`);
    await TestBed.configureTestingModule({ imports: [TestHost, DialogModule] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();

    shortcuts = fixture.componentInstance.shortcuts;
    fired = [];
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(SCAN_THRESHOLD_TOKEN);
    fixture.destroy();
    fixture.nativeElement.remove();
    for (const container of document.querySelectorAll('.cdk-overlay-container')) {
      container.remove();
    }
  });

  /** Registra en un contexto de inyección, como exige `register`. */
  function listen(action: 'search' | 'create' | 'save' | 'cancel'): void {
    TestBed.runInInjectionContext(() => {
      shortcuts.register(action, () => fired.push(action));
    });
  }

  function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  }

  function field(): HTMLInputElement {
    return fixture.nativeElement.querySelector('#field') as HTMLInputElement;
  }

  /** Pasa la ventana de espera de los atajos de un carácter. */
  async function settleDeferral(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, THRESHOLD + 20));
  }

  describe('RFE-01 -- registration is by action, never by key', () => {
    it('PACQ-02.1: the registered handler runs when its key arrives', async () => {
      listen('search');
      press('/');
      await settleDeferral();

      expect(fired).toEqual(['search']);
    });

    it('registering an action twice throws rather than shadowing', () => {
      listen('create');

      expect(() => listen('create')).toThrow(/already registered/);
    });

    it('PACQ-01.2: a destroyed consumer stops answering', async () => {
      @Component({ selector: 'ewms-shortcut-consumer', template: '' })
      class Consumer {
        constructor() {
          inject(KeyboardShortcuts).register('create', () => fired.push('create'));
        }
      }

      const child = TestBed.createComponent(Consumer);
      press('n', { altKey: true });
      expect(fired).toEqual(['create']);

      child.destroy();
      press('n', { altKey: true });

      expect(fired).toEqual(['create']);
      expect(shortcuts.isRegistered('create')).toBe(false);
    });

    it('an unregistered action does not claim the key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'n',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);

      // Nadie registró `create`: la combinación sigue siendo del navegador.
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('RFE-04 -- nothing fires inside a text field, except what says it may', () => {
    it('PACQ-02.2: a printable shortcut character is just a character there', async () => {
      listen('search');
      field().focus();
      press('/', {}, field());
      await settleDeferral();

      expect(fired).toEqual([]);
    });

    it('PACQ-02.5: a modifier combination does not fire there either', () => {
      listen('create');
      press('n', { altKey: true }, field());

      expect(fired).toEqual([]);
    });

    it('PACQ-02.4: Escape says it may, and it fires from inside the field', () => {
      listen('cancel');
      press('Escape', {}, field());

      expect(fired).toEqual(['cancel']);
    });

    it('a checkbox is not a text field, so shortcuts work from it', async () => {
      listen('search');
      const box = fixture.nativeElement.querySelector('#box') as HTMLInputElement;
      press('/', {}, box);
      await settleDeferral();

      expect(fired).toEqual(['search']);
    });
  });

  describe('RFE-02 -- Ctrl+S', () => {
    it('PACQ-02.3: saves the form and never the browser page, from inside a field', () => {
      listen('save');
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      field().dispatchEvent(event);

      expect(fired).toEqual(['save']);
      expect(event.defaultPrevented).toBe(true);
    });

    it('prevents the browser default even with NOBODY registered', () => {
      // Lo dice el binding, no la tecla. Ver vault: Atajos-de-Teclado.
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);

      expect(fired).toEqual([]);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('RFE-05 -- a scan never fires a shortcut', () => {
    it('HG-01: a burst containing `/` delivers one scan and no search', async () => {
      listen('search');
      const scans: string[] = [];
      shortcuts.scans.subscribe((code) => scans.push(code));

      for (const char of 'AB/CD123') {
        press(char);
      }
      press('Enter');
      await settleDeferral();

      expect(scans).toEqual(['AB/CD123']);
      expect(fired).toEqual([]);
    });

    it('a code that BEGINS with `/` does not fire the search either', async () => {
      // En el primer carácter no hay ráfaga: lo salva la espera de un umbral, dentro de
      // la cual llega el segundo carácter.
      listen('search');
      const scans: string[] = [];
      shortcuts.scans.subscribe((code) => scans.push(code));

      for (const char of '/XY9012') {
        press(char);
      }
      press('Enter');
      await settleDeferral();

      expect(scans).toEqual(['/XY9012']);
      expect(fired).toEqual([]);
    });

    it('a person pressing `/` alone still gets the search, after the window', async () => {
      listen('search');
      press('/');

      // Todavía nada: el motor espera por si es una pistola.
      expect(fired).toEqual([]);

      await settleDeferral();
      expect(fired).toEqual(['search']);
    });
  });

  describe('RFE-09 -- WCAG 2.2 2.1.4, single-character shortcuts', () => {
    it('switched off, `/` and `?` do nothing at all', async () => {
      listen('search');
      shortcuts.singleKeyShortcuts.set(false);

      press('/');
      await settleDeferral();

      expect(fired).toEqual([]);
    });

    it('switched off, the ones with a modifier keep working', () => {
      listen('create');
      listen('save');
      shortcuts.singleKeyShortcuts.set(false);

      press('n', { altKey: true });
      press('s', { ctrlKey: true });

      expect(fired).toEqual(['create', 'save']);
    });

    it('Escape keeps working too: it is a named key, not a character', () => {
      listen('cancel');
      shortcuts.singleKeyShortcuts.set(false);

      press('Escape');

      expect(fired).toEqual(['cancel']);
    });
  });

  describe('RFE-03 -- one host, and one only', () => {
    it('HG-04: mounting a second host throws instead of doubling every shortcut', () => {
      expect(() => shortcuts.mount(MAP, MESSAGES)).toThrow(/already mounted/);
    });

    it('an event another handler already answered is left alone', () => {
      // Hoy es el diálogo que cierra con Escape: responder de nuevo cancelaría la pantalla de atrás.
      listen('cancel');
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault();
      document.body.dispatchEvent(event);

      expect(fired).toEqual([]);
    });

    /**
     * Regresión de DS-5: tras un escaneo en select, el Enter siguiente no activaba
     * un botón enfocado (WCAG 2.1.1). Ver vault: Atajos-de-Teclado.
     */
    it('a key somebody else answered still closes the open run', () => {
      listen('cancel');

      // Ráfaga de pistola, sin prevenir.
      for (const char of 'ABCD') {
        press(char, { cancelable: true });
      }

      // El Enter de cierre, consumido por el campo que resolvió el escaneo.
      const consumed = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      consumed.preventDefault();
      document.body.dispatchEvent(consumed);

      // El siguiente es un Enter común: la ráfaga cerró con el anterior.
      const later = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      document.body.dispatchEvent(later);

      expect(later.defaultPrevented).toBe(false);
    });
  });

  describe('RFE-07 -- the help dialog', () => {
    async function openHelp(): Promise<HTMLElement> {
      press('?');
      await settleDeferral();
      fixture.detectChanges();
      await fixture.whenStable();
      return document.querySelector('ewms-shortcut-help') as HTMLElement;
    }

    it('PACQ-04.1: `?` lists every shortcut in the map, read off the map', async () => {
      const dialog = await openHelp();

      expect(dialog).not.toBeNull();
      const keys = [...dialog.querySelectorAll('kbd')].map((k) => k.textContent?.trim());
      expect(keys).toEqual(['/', 'Alt', 'N', 'Ctrl', 'S', 'Esc', '?']);
    });

    it('PACQ-04.3: an action added to the map appears without touching the dialog', async () => {
      const dialog = await openHelp();
      const rows = dialog.querySelectorAll('tbody tr');

      // Una fila por acción del mapa: el diálogo no cuenta nada por su cuenta.
      expect(rows.length).toBe(Object.keys(MAP).length);
    });

    it('carries the 2.1.4 switch, and flipping it silences the single-key ones', async () => {
      const dialog = await openHelp();
      const toggle = dialog.querySelector('input[role="switch"]') as HTMLInputElement;

      expect(toggle).not.toBeNull();
      expect(toggle.checked).toBe(true);

      toggle.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(shortcuts.singleKeyShortcuts()).toBe(false);
    });

    it('RFE-08: has no accessibility violations', async () => {
      const dialog = await openHelp();
      await expectNoAxeViolations(dialog);
    });
  });
});
