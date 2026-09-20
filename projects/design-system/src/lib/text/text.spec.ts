import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { Text, type TextVariant } from './text';

@Component({
  template: `<ewms-text [variant]="variant">Sample Text Content</ewms-text>`,
  imports: [Text],
})
class TestHost {
  variant: TextVariant = 'h1';
}

describe('Text', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost, Text],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
  });

  const variantToTag: readonly [TextVariant, string][] = [
    ['h1', 'H1'],
    ['h2', 'H2'],
    ['h3', 'H3'],
    ['h4', 'H4'],
    ['p', 'P'],
    ['caption', 'SPAN'],
    ['mono', 'SPAN'],
  ];

  it.each(variantToTag)(
    'renders the semantic <%s> element for variant "%s"',
    async (variant, expectedTag) => {
      fixture.componentInstance.variant = variant;
      fixture.detectChanges();
      await fixture.whenStable();

      const element = fixture.nativeElement.querySelector('ewms-text');
      expect(element).not.toBeNull();

      const child = element?.firstElementChild;
      expect(child?.tagName).toBe(expectedTag);
    },
  );

  it('preserves text content capitalization on h4 while applying uppercase class', async () => {
    fixture.componentInstance.variant = 'h4';
    fixture.detectChanges();
    await fixture.whenStable();

    const h4 = fixture.nativeElement.querySelector('h4');
    expect(h4).not.toBeNull();
    expect(h4.textContent).toBe('Sample Text Content');
    expect(h4.classList.contains('uppercase')).toBe(true);
  });

  it('renders caption and mono as span without heading roles', async () => {
    for (const variant of ['caption', 'mono'] as const) {
      fixture.componentInstance.variant = variant;
      fixture.detectChanges();
      await fixture.whenStable();

      const span = fixture.nativeElement.querySelector('span');
      expect(span).not.toBeNull();
      expect(span.getAttribute('role')).toBeNull();
      expect(fixture.nativeElement.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
    }
  });

  it.each(variantToTag)(
    'passes axe accessibility checks for variant "%s"',
    async (variant) => {
      fixture.componentInstance.variant = variant;
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    },
  );
});
