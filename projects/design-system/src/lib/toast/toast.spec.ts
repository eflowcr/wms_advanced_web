import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import type { FeedbackVariant } from '../feedback/feedback.types';
import { ToastOutlet } from './toast-outlet';
import { ToastService } from './toast.service';
import { TOAST_DURATION_TOKEN } from './toast.types';

const LABELS: Readonly<Record<FeedbackVariant, string>> = {
  success: 'Éxito',
  warning: 'Advertencia',
  danger: 'Error',
  info: 'Información',
};

@Component({
  template: `<ewms-toast-outlet [severityLabels]="labels" regionLabel="Notificaciones" />`,
  imports: [ToastOutlet],
})
class TestHost {
  readonly labels = LABELS;
}

describe('Toast', () => {
  let fixture: ComponentFixture<TestHost>;
  let toasts: ToastService;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [TestHost, ToastOutlet] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    toasts = TestBed.inject(ToastService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    document.documentElement.style.removeProperty(TOAST_DURATION_TOKEN);
    vi.useRealTimers();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function rows(): readonly Element[] {
    return [...fixture.nativeElement.querySelectorAll('[role="status"] > div')];
  }

  function region(): HTMLElement {
    return fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
  }

  describe('the live region', () => {
    it('is in the document before there is anything to say', () => {
      expect(region()).not.toBeNull();
      expect(rows().length).toBe(0);
    });

    it('is polite and named, and there is exactly one of it', async () => {
      toasts.show('success', 'Guardado');
      await settle();
      expect(region().getAttribute('aria-live')).toBe('polite');
      expect(region().getAttribute('aria-label')).toBe('Notificaciones');
      expect(fixture.nativeElement.querySelectorAll('[aria-live]').length).toBe(1);
    });
  });

  describe('the queue', () => {
    it('stacks several, oldest first', async () => {
      toasts.show('success', 'Uno');
      toasts.show('warning', 'Dos');
      toasts.show('danger', 'Tres');
      await settle();

      const text = rows().map((row) => row.textContent ?? '');
      expect(text.length).toBe(3);
      expect(text[0]).toContain('Uno');
      expect(text[1]).toContain('Dos');
      expect(text[2]).toContain('Tres');
    });

    it('dismisses by id, and an id that is gone is not an error', async () => {
      const id = toasts.show('info', 'Sincronizando');
      await settle();
      expect(rows().length).toBe(1);

      toasts.dismiss(id);
      toasts.dismiss(id);
      await settle();
      expect(rows().length).toBe(0);
    });

    it('clear() empties it', async () => {
      toasts.show('info', 'Uno');
      toasts.show('info', 'Dos');
      toasts.clear();
      await settle();
      expect(rows().length).toBe(0);
    });
  });

  describe('how long a message lives', () => {
    it('takes its default from --duration-toast, read from the document', async () => {
      document.documentElement.style.setProperty(TOAST_DURATION_TOKEN, '3000ms');
      toasts.show('success', 'Guardado');
      await settle();
      expect(rows().length).toBe(1);

      vi.advanceTimersByTime(2999);
      await settle();
      expect(rows().length).toBe(1);

      vi.advanceTimersByTime(1);
      await settle();
      expect(rows().length).toBe(0);
    });

    it('stays for ever when the token is not declared -- no invented number', async () => {
      toasts.show('success', 'Guardado');
      await settle();
      vi.advanceTimersByTime(60_000);
      await settle();
      expect(rows().length).toBe(1);
    });

    it('a duration on the call overrides the token', async () => {
      document.documentElement.style.setProperty(TOAST_DURATION_TOKEN, '3000ms');
      toasts.show('warning', 'Revise la ubicación', 500);
      await settle();
      vi.advanceTimersByTime(500);
      await settle();
      expect(rows().length).toBe(0);
    });

    it('a duration of zero means "this one has to be read"', async () => {
      document.documentElement.style.setProperty(TOAST_DURATION_TOKEN, '3000ms');
      toasts.show('danger', 'No se pudo confirmar', 0);
      await settle();
      vi.advanceTimersByTime(60_000);
      await settle();
      expect(rows().length).toBe(1);
    });
  });

  describe('Escape closes the most recent', () => {
    function pressEscape(): void {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    }

    it('takes the newest off the stack, not the oldest', async () => {
      toasts.show('info', 'Vieja');
      toasts.show('info', 'Nueva');
      await settle();

      pressEscape();
      await settle();

      expect(rows().length).toBe(1);
      expect(rows()[0]?.textContent).toContain('Vieja');
    });

    it('does nothing when there is nothing up', async () => {
      pressEscape();
      await settle();
      expect(rows().length).toBe(0);
    });

    it('leaves alone an Escape that something else already handled', async () => {
      toasts.show('info', 'Sigo acá');
      await settle();

      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault();
      document.dispatchEvent(event);
      await settle();

      expect(rows().length).toBe(1);
    });
  });

  describe('the four variants', () => {
    const CASES: readonly (readonly [FeedbackVariant, string])[] = [
      ['success', 'success'],
      ['warning', 'warning'],
      ['danger', 'danger'],
      ['info', 'neutral'],
    ];

    for (const [variant, family] of CASES) {
      it(`${variant} paints ${family}, with the accent in the solid`, async () => {
        toasts.show(variant, 'Mensaje');
        await settle();

        const row = rows()[0] as HTMLElement;
        expect(row.className).toContain(`bg-${family}-surface`);

        const accent = row.firstElementChild as HTMLElement;
        expect(accent.className).toContain(`bg-${family}-solid`);
      });
    }

    it('names the severity on the icon, in the words the consumer passed', async () => {
      toasts.show('danger', 'No se pudo confirmar');
      await settle();
      const icon = fixture.nativeElement.querySelector('[role="img"]') as HTMLElement;
      expect(icon.getAttribute('aria-label')).toBe('Error');
    });
  });

  it('has no axe violations with the four up at once', async () => {
    // axe necesita el reloj real; el resto del archivo maneja los timers a mano.
    vi.useRealTimers();
    toasts.show('success', 'Guardado');
    toasts.show('warning', 'Stock bajo');
    toasts.show('danger', 'Sin conexión');
    toasts.show('info', 'Sincronizando');
    await settle();
    await expectNoAxeViolations(fixture.nativeElement);
  });
});
