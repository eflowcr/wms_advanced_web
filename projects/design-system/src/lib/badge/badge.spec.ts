import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import type { SemanticFamily } from '../feedback/feedback.types';
import { Badge } from './badge';

const FAMILIES: readonly SemanticFamily[] = ['neutral', 'success', 'warning', 'danger'];

@Component({
  template: `<ewms-badge [variant]="variant()" [label]="label()" />`,
  imports: [Badge],
})
class TestHost {
  readonly variant = signal<SemanticFamily>('neutral');
  readonly label = signal('Pendiente');
}

describe('Badge', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost, Badge] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('always shows the words AND a drawing', () => {
    // WCAG 1.4.1: sin modo solo-icono, que sería un color con un dibujo encima.
    expect(fixture.nativeElement.textContent).toContain('Pendiente');
    expect(fixture.nativeElement.querySelector('svg')).not.toBeNull();
  });

  describe('the four families', () => {
    for (const family of FAMILIES) {
      it(`${family} paints surface, border and text of its own family`, async () => {
        host.variant.set(family);
        await settle();

        const box = fixture.nativeElement.querySelector('span') as HTMLElement;
        expect(box.className).toContain(`bg-${family}-surface`);
        expect(box.className).toContain(`border-${family}`);
        expect(box.className).toContain(`text-${family}`);
      });
    }

    it('never uses the solid fill with white on it', async () => {
      // Neutral llegaría a 4.19:1 así (Fundamentos de Marca); las otras tres lo siguen.
      for (const family of FAMILIES) {
        host.variant.set(family);
        await settle();
        const box = fixture.nativeElement.querySelector('span') as HTMLElement;
        expect(box.className).not.toContain(`bg-${family}-solid`);
      }
    });

    it('draws a different glyph per family', async () => {
      const shapes: string[] = [];
      for (const family of FAMILIES) {
        host.variant.set(family);
        await settle();
        shapes.push(fixture.nativeElement.querySelector('svg')?.outerHTML ?? '');
      }
      expect(new Set(shapes).size).toBe(FAMILIES.length);
    });
  });

  it('hides the icon from assistive technology, because the label says it', () => {
    expect(fixture.nativeElement.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="img"]')).toBeNull();
  });

  it('has no axe violations, in any family', async () => {
    for (const family of FAMILIES) {
      host.variant.set(family);
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    }
  });
});
