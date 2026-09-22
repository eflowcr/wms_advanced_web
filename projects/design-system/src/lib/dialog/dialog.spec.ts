import { DialogModule } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { DialogService } from './dialog.service';
import { backdropDismisses, type ConfirmOptions, type DialogTone } from './dialog.types';

const BASE: ConfirmOptions = {
  title: 'Eliminar la expedición',
  body: 'Se van a soltar 34 bultos ya asignados. No se puede deshacer.',
  tone: 'danger',
  confirmLabel: 'Eliminar',
  cancelLabel: 'Cancelar',
};

@Component({
  template: `<button type="button" id="opener">Eliminar</button>`,
})
class TestHost {
  readonly dialogs = inject(DialogService);
}

describe('DialogService', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost, DialogModule] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    // El que abre tiene que estar en el documento para que el foco tenga adónde volver.
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    for (const container of document.querySelectorAll('.cdk-overlay-container')) {
      container.remove();
    }
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function box(): HTMLElement | null {
    return document.querySelector('.cdk-dialog-container');
  }

  function buttons(): HTMLButtonElement[] {
    return [...document.querySelectorAll<HTMLButtonElement>('.cdk-dialog-container button')];
  }

  function backdrop(): HTMLElement | null {
    return document.querySelector('.cdk-overlay-backdrop');
  }

  function pressEscape(): void {
    box()?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  }

  describe('confirm', () => {
    it('shows the title, the body and the two labels', async () => {
      void host.dialogs.confirm(BASE);
      await settle();

      const text = box()?.textContent ?? '';
      expect(text).toContain(BASE.title);
      expect(text).toContain(BASE.body);
      expect(buttons().map((button) => button.textContent?.trim())).toEqual([
        'Cancelar',
        'Eliminar',
      ]);
    });

    it('resolves true only when the confirm button is pressed', async () => {
      const answer = host.dialogs.confirm(BASE);
      await settle();

      buttons()[1]?.click();
      await settle();

      expect(await answer).toBe(true);
    });

    it('resolves false on cancel', async () => {
      const answer = host.dialogs.confirm(BASE);
      await settle();

      buttons()[0]?.click();
      await settle();

      expect(await answer).toBe(false);
    });

    it('puts Cancel first, so the keyboard lands on the safe answer', async () => {
      void host.dialogs.confirm(BASE);
      await settle();
      expect(buttons()[0]?.textContent?.trim()).toBe('Cancelar');
    });

    it('names itself with its own title and describes itself with its own body', async () => {
      void host.dialogs.confirm(BASE);
      await settle();

      const labelledBy = box()?.getAttribute('aria-labelledby');
      const describedBy = box()?.getAttribute('aria-describedby');

      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy!)?.textContent).toContain(BASE.title);
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)?.textContent).toContain(BASE.body);
    });

    it('is a modal dialog with a role', async () => {
      void host.dialogs.confirm(BASE);
      await settle();
      expect(box()?.getAttribute('role')).toBe('dialog');
      expect(box()?.getAttribute('aria-modal')).toBe('true');
    });
  });

  describe('the three tones', () => {
    const CASES: readonly (readonly [DialogTone, string, string])[] = [
      ['danger', 'danger', 'bg-danger'],
      ['warning', 'warning', 'bg-primary'],
      // Info se pinta neutral: la regla de marca reemplazó el azul de Figma.
      ['info', 'neutral', 'bg-primary'],
    ];

    for (const [tone, family, confirmClass] of CASES) {
      it(`${tone} paints its glyph ${family}, with nothing behind it, and its confirm button ${confirmClass}`, async () => {
        void host.dialogs.confirm({ ...BASE, tone });
        await settle();

        const glyph = box()?.querySelector('[data-dialog-icon]') as HTMLElement;
        // Solo el color de la familia: sin fondo, aro ni halo.
        expect(glyph.className).toBe(`flex shrink-0 text-${family}`);
        expect(glyph.querySelector('svg')).not.toBeNull();

        expect(buttons()[1]?.className).toContain(confirmClass);
      });
    }
  });

  describe('Escape and the backdrop', () => {
    it('Escape closes every tone, and answers false', async () => {
      for (const tone of ['danger', 'warning', 'info'] as const) {
        const answer = host.dialogs.confirm({ ...BASE, tone });
        await settle();

        pressEscape();
        await settle();

        expect(await answer, tone).toBe(false);
        expect(box(), tone).toBeNull();
      }
    });

    it('marks Escape handled, so nothing behind the dialog answers it too', async () => {
      void host.dialogs.confirm(BASE);
      await settle();

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      box()?.dispatchEvent(event);
      await settle();

      expect(event.defaultPrevented).toBe(true);
    });

    it('the backdrop does NOT close a destructive dialog: deliberate friction', async () => {
      void host.dialogs.confirm({ ...BASE, tone: 'danger' });
      await settle();

      backdrop()?.click();
      await settle();

      expect(box()).not.toBeNull();
    });

    it('the backdrop does close an informative one', async () => {
      const answer = host.dialogs.confirm({ ...BASE, tone: 'info' });
      await settle();

      backdrop()?.click();
      await settle();

      expect(await answer).toBe(false);
      expect(box()).toBeNull();
    });

    it('the rule is one function, so the two halves cannot drift', () => {
      expect(backdropDismisses('danger')).toBe(false);
      expect(backdropDismisses('warning')).toBe(true);
      expect(backdropDismisses('info')).toBe(true);
    });
  });

  describe('the focus', () => {
    it('goes into the dialog, and comes back to the opener on close', async () => {
      const opener = fixture.nativeElement.querySelector('#opener') as HTMLButtonElement;
      opener.focus();
      expect(document.activeElement).toBe(opener);

      const answer = host.dialogs.confirm(BASE);
      await settle();
      expect(box()?.contains(document.activeElement)).toBe(true);

      pressEscape();
      await settle();
      await answer;

      expect(document.activeElement).toBe(opener);
    });
  });

  describe('open', () => {
    @Component({ template: `<h2 id="form-title">Editar ubicación</h2><input />` })
    class FormDialog {}

    it('returns the CDK reference and renders the component', async () => {
      const ref = host.dialogs.open<string, { sku: string }, FormDialog>(FormDialog, {
        data: { sku: 'SKU-1' },
        ariaLabelledBy: 'form-title',
      });
      await settle();

      expect(box()?.textContent).toContain('Editar ubicación');
      expect(box()?.getAttribute('aria-labelledby')).toBe('form-title');

      ref.close('guardado');
      await settle();
      expect(box()).toBeNull();
    });

    it('closes on the backdrop by default, and does not when asked not to', async () => {
      const closing = host.dialogs.open<string, undefined, FormDialog>(FormDialog);
      await settle();
      backdrop()?.click();
      await settle();
      expect(box()).toBeNull();
      expect(closing.closed).toBeTruthy();

      host.dialogs.open<string, undefined, FormDialog>(FormDialog, { dismissOnBackdrop: false });
      await settle();
      backdrop()?.click();
      await settle();
      expect(box()).not.toBeNull();
    });

    it('takes an aria-label when there is no heading to point at', async () => {
      host.dialogs.open<string, undefined, FormDialog>(FormDialog, { ariaLabel: 'Editar' });
      await settle();
      expect(box()?.getAttribute('aria-label')).toBe('Editar');
    });
  });

  it('has no axe violations', async () => {
    void host.dialogs.confirm(BASE);
    await settle();
    await expectNoAxeViolations(box()!);
  });
});
