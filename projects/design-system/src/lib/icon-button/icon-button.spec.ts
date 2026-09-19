import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import type { IconName } from '../../icons/icons.generated';
import type { ButtonSize, ButtonVariant } from '../button/button.types';
import { Icon } from '../icon/icon';
import { TOOLTIP_SHOW_DELAY_MS } from '../tooltip/tooltip.types';
import { IconButton } from './icon-button';

@Component({
  template: `
    <div id="parent-container">
      <ewms-icon-button
        [icon]="icon()"
        [label]="label()"
        [tooltip]="tooltip()"
        [variant]="variant()"
        [size]="size()"
        [disabled]="disabled()"
        [loading]="loading()"
        (click)="onButtonClick($event)"
      />
    </div>
  `,
  imports: [IconButton],
})
class TestHost {
  readonly icon = signal<IconName>('trash');
  readonly label = signal('Eliminar');
  readonly tooltip = signal('Eliminar');
  readonly variant = signal<ButtonVariant>('ghost');
  readonly size = signal<ButtonSize>('md');
  readonly disabled = signal(false);
  readonly loading = signal(false);

  buttonClicked = false;

  onButtonClick(_event: MouseEvent): void {
    this.buttonClicked = true;
  }
}

function tooltipPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '.cdk-overlay-container div[id^="ewms-tooltip-"]',
  );
}

describe('IconButton', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let parentClicked: boolean;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost, IconButton],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    parentClicked = false;

    const parent = fixture.nativeElement.querySelector('#parent-container');
    parent?.addEventListener('click', () => {
      parentClicked = true;
    });

    fixture.detectChanges();
    await fixture.whenStable();
  });

  function button(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
  }

  describe('Accessible name', () => {
    it('names the button with label, not with the icon', () => {
      expect(button().getAttribute('aria-label')).toBe('Eliminar');
      // The icon is decoration: the name comes from the label.
      const icon = fixture.debugElement.query(By.directive(Icon));
      expect((icon.nativeElement as Element).querySelector('svg')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
    });

    const variants: readonly ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];

    it.each(variants)('is findable by role and name in variant "%s"', async (variant) => {
      host.variant.set(variant);
      fixture.detectChanges();
      await fixture.whenStable();

      // The jsdom equivalent of getByRole('button', { name: 'Eliminar' }).
      const root = fixture.nativeElement as Element;
      const found = Array.from(root.querySelectorAll('button')).filter(
        (element) => element.getAttribute('aria-label') === 'Eliminar',
      );

      expect(found).toHaveLength(1);
    });

    const sizes: readonly ButtonSize[] = ['sm', 'md', 'lg'];

    it.each(sizes)('is findable by role and name in size "%s"', async (size) => {
      host.size.set(size);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(button().getAttribute('aria-label')).toBe('Eliminar');
    });
  });

  describe('Defaults', () => {
    it('defaults to the ghost variant, the lowest emphasis', async () => {
      // A default of `primary` would fill every table row with blue boxes.
      const classes = button().classList;
      expect(classes.contains('hover:bg-ghost-hover')).toBe(true);
      expect(classes.contains('bg-primary')).toBe(false);
    });

    it('defaults to the md square box', () => {
      // Angular renders the class list sorted, so each utility is checked on
      // its own rather than as a contiguous string.
      expect(button().classList.contains('h-10')).toBe(true);
      expect(button().classList.contains('w-10')).toBe(true);
    });
  });

  describe('Sizing', () => {
    // The box classes are square by construction: one utility sets both
    // dimensions from the same scale step. jsdom does no layout, so the
    // RENDERED box cannot be measured here -- see the note in the PR report;
    // that criterion is covered by nothing in this PR.
    const boxes: readonly (readonly [ButtonSize, string, string])[] = [
      ['sm', 'h-8', 'w-8'],
      ['md', 'h-10', 'w-10'],
      ['lg', 'h-12', 'w-12'],
    ];

    it.each(boxes)(
      'applies the square box utilities for size "%s"',
      async (size, height, width) => {
        host.size.set(size);
        fixture.detectChanges();
        await fixture.whenStable();

        // Same scale step on both axes is what makes the box square.
        expect(button().classList.contains(height)).toBe(true);
        expect(button().classList.contains(width)).toBe(true);
        expect(height.replace('h-', '')).toBe(width.replace('w-', ''));
      },
    );

    it('uses the Button icon mapping: sm at Small, md at Medium and Large', async () => {
      const iconSizes: readonly (readonly [ButtonSize, string])[] = [
        ['sm', 'sm'],
        ['md', 'md'],
        // Deliberately md and not a larger one: two icons of different sizes
        // side by side in a toolbar read as a mistake.
        ['lg', 'md'],
      ];

      for (const [size, expected] of iconSizes) {
        host.size.set(size);
        fixture.detectChanges();
        await fixture.whenStable();

        const icon = fixture.debugElement.query(By.directive(Icon)).componentInstance as Icon;
        expect(icon.size()).toBe(expected);
      }
    });
  });

  describe('Loading pattern', () => {
    it('marks aria-busy and aria-disabled without the native attribute', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(button().getAttribute('aria-busy')).toBe('true');
      expect(button().getAttribute('aria-disabled')).toBe('true');
      // No native `disabled`, so the button keeps the focus while it loads.
      expect(button().hasAttribute('disabled')).toBe(false);
      expect(button().getAttribute('aria-label')).toBe('Eliminar');
    });

    it('hides the icon with visibility, keeping it in the DOM', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const content = button().querySelector('span');
      expect(content?.classList.contains('invisible')).toBe(true);
      expect(fixture.debugElement.query(By.css('ewms-icon[name="spinner"]'))).not.toBeNull();
    });

    it('suppresses (click) and stops native bubbling to a parent listener during loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      button().click();

      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('suppresses Enter keydown during loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      button().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );

      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('retains focus when entering loading', async () => {
      button().focus();
      expect(document.activeElement).toBe(button());

      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(button());
    });
  });

  describe('Disabled state', () => {
    it('applies the native disabled attribute and prevents clicks', async () => {
      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(button().disabled).toBe(true);
      expect(button().hasAttribute('aria-disabled')).toBe(false);

      button().click();
      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('stays natively disabled when disabled and loading are both set', async () => {
      host.disabled.set(true);
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(button().disabled).toBe(true);
      expect(button().getAttribute('aria-busy')).toBe('true');
      expect(button().hasAttribute('aria-disabled')).toBe(false);
    });
  });

  describe('Focus ring', () => {
    it('draws the ring from CSS on :focus-visible, with no inline box-shadow', () => {
      expect(button().classList.contains('focus-visible:shadow-(--focus-ring-shadow)')).toBe(true);
      expect(button().style.boxShadow).toBe('');

      button().focus();
      expect(button().style.boxShadow).toBe('');
    });
  });

  describe('Tooltip', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('shows the tooltip on hover', () => {
      vi.useFakeTimers();

      button().dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(TOOLTIP_SHOW_DELAY_MS);
      fixture.detectChanges();

      expect(tooltipPanel()?.textContent).toBe('Eliminar');
    });

    it('shows the tooltip on keyboard focus', () => {
      vi.useFakeTimers();

      button().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      expect(tooltipPanel()?.textContent).toBe('Eliminar');
    });

    it('keeps the tooltip out of the accessible name: describes is false', () => {
      vi.useFakeTimers();

      button().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      // aria-label already says "Eliminar". Connecting the panel with
      // aria-describedby would announce it a second time.
      expect(tooltipPanel()?.getAttribute('aria-hidden')).toBe('true');
      expect(button().hasAttribute('aria-describedby')).toBe(false);
    });

    it('carries its own text, which is not derived from label', async () => {
      vi.useFakeTimers();

      host.tooltip.set('Eliminar (no se puede deshacer)');
      fixture.detectChanges();

      button().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      expect(tooltipPanel()?.textContent).toBe('Eliminar (no se puede deshacer)');
      expect(button().getAttribute('aria-label')).toBe('Eliminar');
    });
  });

  describe('Accessibility (axe)', () => {
    const variants: readonly ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];

    it.each(variants)('passes axe in variant "%s"', async (variant) => {
      host.variant.set(variant);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe in loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe in disabled', async () => {
      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });
  });
});
