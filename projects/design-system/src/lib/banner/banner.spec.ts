import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { Banner, type FeedbackVariant } from './banner';

/** Variante, familia con la que pinta y rol. */
const VARIANTS: readonly (readonly [FeedbackVariant, string, string])[] = [
  ['success', 'success', 'status'],
  ['warning', 'warning', 'alert'],
  ['danger', 'danger', 'alert'],
  // Info se pinta neutral: por esta fila existe la tabla.
  ['info', 'neutral', 'status'],
];

@Component({
  template: `
    <ewms-banner
      [variant]="variant()"
      [title]="title()"
      [description]="description()"
      [severityLabel]="severityLabel()"
      [dismissible]="dismissible()"
      [dismissLabel]="dismissLabel()"
      (dismiss)="dismissed = dismissed + 1"
    />
  `,
  imports: [Banner],
})
class TestHost {
  readonly variant = signal<FeedbackVariant>('info');
  readonly title = signal('Recepción parcial');
  readonly description = signal('Faltan 3 de 12 líneas por confirmar.');
  readonly severityLabel = signal('Información');
  readonly dismissible = signal(false);
  readonly dismissLabel = signal('Cerrar aviso');

  dismissed = 0;
}

describe('Banner', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost, Banner] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function box(): HTMLElement {
    return fixture.nativeElement.querySelector('[role]') as HTMLElement;
  }

  it('shows the title and the description', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Recepción parcial');
    expect(text).toContain('Faltan 3 de 12 líneas por confirmar.');
  });

  it('renders without a description: a one-line banner is a banner', async () => {
    host.description.set('');
    await settle();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Recepción parcial');
    expect(fixture.nativeElement.querySelectorAll('p[class*="text-p"]').length).toBe(0);
  });

  describe('the four variants', () => {
    for (const [variant, family, role] of VARIANTS) {
      it(`${variant} paints with the ${family} family and announces as ${role}`, async () => {
        host.variant.set(variant);
        await settle();
        expect(box().getAttribute('role')).toBe(role);
        expect(box().className).toContain(`bg-${family}-surface`);
        expect(box().className).toContain(`border-${family}`);
        expect(box().className).toContain(`text-${family}`);
      });
    }

    it('info never paints blue: there is no info colour family', async () => {
      host.variant.set('info');
      await settle();
      expect(box().className).not.toContain('primary');
    });
  });

  describe('the icon is the cue the colour cannot be', () => {
    it('carries the severity as its accessible name', () => {
      const icon = fixture.nativeElement.querySelector('[role="img"]') as HTMLElement;
      expect(icon.getAttribute('aria-label')).toBe('Información');
    });

    it('is chosen by the component and changes with the variant', async () => {
      const shapes: string[] = [];
      for (const [variant] of VARIANTS) {
        host.variant.set(variant);
        await settle();
        shapes.push(fixture.nativeElement.querySelector('svg')?.outerHTML ?? '');
      }
      expect(new Set(shapes).size).toBe(VARIANTS.length);
    });
  });

  describe('dismissing', () => {
    it('shows no close button unless it is asked for', () => {
      expect(fixture.nativeElement.querySelector('button')).toBeNull();
    });

    it('emits (dismiss) and does NOT remove itself', async () => {
      host.dismissible.set(true);
      await settle();

      const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(button.getAttribute('aria-label')).toBe('Cerrar aviso');

      button.click();
      await settle();

      expect(host.dismissed).toBe(1);
      // Sigue en pantalla: sacarlo lo decide el consumidor.
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Recepción parcial');
    });
  });

  describe('accessibility', () => {
    for (const [variant] of VARIANTS) {
      it(`${variant}, dismissible, has no axe violations`, async () => {
        host.variant.set(variant);
        host.dismissible.set(true);
        await settle();
        await expectNoAxeViolations(fixture.nativeElement);
      });
    }
  });
});
