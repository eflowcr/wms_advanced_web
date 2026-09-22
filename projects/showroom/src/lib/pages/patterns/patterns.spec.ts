import { DialogModule } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SCAN_THRESHOLD_TOKEN, ShortcutsHost } from '@ewms/design-system';
import { provideShowroomDesignSystem } from '../../showroom.providers';
import { ShowroomKeyboard } from './keyboard';
import { ShowroomSearchCreateEdit } from './search-create-edit';

/*
 * Las páginas de patrón, usadas (estructura y axe están en pages.spec.ts). El motor de atajos
 * es real y solo despacha montado por un layout raíz (`MainLayout` en el shell): el host de abajo
 * hace ese papel. Los clics reales con puntero se cuentan en e2e/click-budget.e2e.ts.
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

/** El contenedor de overlays del CDK, donde se renderiza el diálogo. */
function overlay(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function cleanUpOverlays(): void {
  for (const container of document.querySelectorAll('.cdk-overlay-container')) {
    container.remove();
  }
}

// Umbral declarado a mano: jsdom no carga tokens.css, y sin `--threshold-scan-keystroke` nada
// se clasifica como escaneo y esos casos pasarían en vacío. Igual que select.spec.ts.
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
    // En el document, para que el foco y el overlay tengan dónde vivir.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  }

  // Una tecla por carácter a velocidad de pistola, cerrada con Enter. Síncrono a propósito:
  // dormir 5 ms entre teclas puede tardar 50 en una máquina cargada y romper la ráfaga;
  // en bucle cerrado los huecos son cero, bajo cualquier umbral.
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
      // El registro nuevo va arriba de la tabla, y por eso la búsqueda siguiente lo encuentra.
      expect(page.querySelector('tbody [role="row"]')?.textContent).toContain('EXP-2026-0777');
    });

    it('a record saved with nothing typed still gets a code and a client', async () => {
      // Formulario vacío: una pantalla demo no debe meter una fila en blanco.
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
      // El registro vive lo que el inyector del diálogo: así la pantalla de atrás recupera
      // la acción sin que ninguno conozca al otro.
      press('n', { altKey: true });
      await settle();
      press('Escape', {}, query('[data-expedicion-form]')!);
      await settle();

      // Abrir un segundo formulario no debe lanzar «already registered».
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

    // `element.click()` no es un clic de mouse: lleva `detail === 0`, igual que una activación
    // por teclado, que §2.1 puntúa en cero y el contador ignora desde DS-5. Acá se hace con `detail: 1`.
    function mouseClick(element: HTMLElement): void {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    }

    it('counts a click on a control, and ignores its own scaffolding', async () => {
      const count = (): string => query('[data-click-count]')!.textContent!.trim();

      mouseClick(query<HTMLButtonElement>('[data-new-button] button')!);
      await settle();
      expect(count()).toBe('1');

      // Reiniciar y el interruptor de falla son la demo hablando de sí misma.
      mouseClick(query<HTMLButtonElement>('[data-reset-clicks]')!);
      await settle();
      expect(count()).toBe('0');

      mouseClick(query<HTMLButtonElement>('[data-toggle-failure]')!);
      await settle();
      expect(count()).toBe('0');
    });

    it('a KEYBOARD activation costs nothing, which is what the standard says', async () => {
      const count = (): string => query('[data-click-count]')!.textContent!.trim();

      // `detail: 0` es lo que despacha el navegador cuando Enter o Espacio activan un control.
      // §2.1: «Tab, flechas y Enter para recorrer y activar» = 0.
      query<HTMLButtonElement>('[data-new-button] button')!.click();
      await settle();

      expect(count()).toBe('0');
    });

    it('a broken source is a banner, because the condition stays true', async () => {
      expect(page.querySelector('ewms-banner')).toBeNull();

      query<HTMLButtonElement>('[data-toggle-failure]')!.click();
      await settle();

      expect(page.querySelector('ewms-banner')).not.toBeNull();
      // Y se puede revertir: es una demostración, no una puerta de una sola vía.
      query<HTMLButtonElement>('[data-toggle-failure]')!.click();
      await settle();
      expect(page.querySelector('ewms-banner')).toBeNull();
    });

    it('the search source answers, and a result can be chosen from the panel', async () => {
      // Único caso que recorre `ExpedicionSource` de punta a punta: el escaneo resuelve contra
      // las filas en memoria y nunca le pregunta a la fuente.
      const field = page.querySelector<HTMLInputElement>('[data-search-host] input')!;
      field.focus();
      field.value = 'textiles';
      field.dispatchEvent(new Event('input', { bubbles: true }));

      // Más que la demora de entrada y la latencia de la fuente.
      await new Promise((resolve) => setTimeout(resolve, 700));
      await settle();

      // El panel es un overlay del CDK: no está dentro del árbol del componente.
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

      // En el flujo, no en el panel: el selector dibuja la falla bajo el campo, con Reintentar
      // a un Tab. Por eso se lee el árbol del componente y no el overlay.
      expect(page.querySelector('[data-search-host]')?.textContent).toContain(
        'No se pudo consultar',
      );
    });

    it('activating a row in the table opens it for editing', async () => {
      // Doble clic: la mitad de mouse de `(rowActivate)`; la otra es Enter sobre la fila enfocada.
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

      const estado = query<HTMLInputElement>('[data-form-estado] input[role="combobox"]');
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
      // La otra mitad del escaneo (DS-3): con foco en el selector, el campo clasifica la ráfaga
      // y la compara con `display.code`. Con foco en ningún lado responde la suscripción de la pantalla.
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
      // Un <form> que no hiciera nada al enviarse es una trampa para quien le agregue una versión
      // de un solo campo; la única forma honesta de mantener vivo ese cable es ejercitarlo.
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

      query<HTMLInputElement>('[data-form-estado] input')!.click();
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
      // El motor difiere un atajo de un carácter una ventana de umbral.
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

      expect(actions).toEqual([
        ...['search', 'create', 'save', 'cancel', 'filters'],
        ...['moveColumnLeft', 'moveColumnRight', 'help'],
      ]);
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
      // Todavía espera: una pistola que arrancó con `/` llegaría justo ahora.
      expect(page.querySelector('[data-demo-search-hits]')?.textContent?.trim()).toBe('0');

      await new Promise((resolve) => setTimeout(resolve, THRESHOLD_MS * 3));
      await settle();
      expect(page.querySelector('[data-demo-search-hits]')?.textContent?.trim()).toBe('1');

      press('n', { altKey: true });
      await settle();
      expect(page.querySelector('[data-demo-create-hits]')?.textContent?.trim()).toBe('1');
    });

    it('shows `unregistered` for an action nobody answered', async () => {
      // `save` queda sin registrar a propósito en esta página, para que el resultado se vea.
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
