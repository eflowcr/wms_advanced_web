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
    // The colour is never the only signal (WCAG 1.4.1), and a badge has no
    // room for a second line -- so the label IS the text and the icon sits
    // beside it. There is no icon-only mode on purpose: that would be a colour
    // with a picture on it.
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
      // Badge/Neutral would reach only 4.19:1 that way (Fundamentos de Marca),
      // and the other three follow it so the four read as one family.
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
    // Announcing the severity twice is noise, not redundancy: the words are
    // right there.
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
