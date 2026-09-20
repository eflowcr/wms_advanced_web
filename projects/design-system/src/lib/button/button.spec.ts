import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import type { IconName } from '../../icons/icons.generated';
import { Icon } from '../icon/icon';
import { Button } from './button';
import type { ButtonIconPosition, ButtonSize, ButtonVariant } from './button.types';

@Component({
  template: `
    <div id="parent-container">
      <ewms-button
        [variant]="variant()"
        [size]="size()"
        [icon]="icon()"
        [iconPosition]="iconPosition()"
        [disabled]="disabled()"
        [loading]="loading()"
        (click)="onButtonClick($event)"
      >
        Save Changes
      </ewms-button>
    </div>
  `,
  imports: [Button],
})
class TestHost {
  readonly variant = signal<ButtonVariant>('primary');
  readonly size = signal<ButtonSize>('md');
  readonly icon = signal<IconName | null>(null);
  readonly iconPosition = signal<ButtonIconPosition>('left');
  readonly disabled = signal(false);
  readonly loading = signal(false);

  buttonClicked = false;

  onButtonClick(_event: MouseEvent): void {
    this.buttonClicked = true;
  }
}

describe('Button', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let parentClicked: boolean;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost, Button],
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

  it('renders a native button with accessible name matching projected text', () => {
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Save Changes');
  });

  describe('Loading pattern', () => {
    it('keeps accessible name via aria-labelledby and marks aria-busy and aria-disabled during loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.hasAttribute('disabled')).toBe(false);

      const labelId = button.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();

      const content = fixture.nativeElement.querySelector(`#${labelId}`);
      expect(content).not.toBeNull();
      expect(content?.textContent).toContain('Save Changes');
      expect(content?.classList.contains('invisible')).toBe(true);

      const spinner = fixture.debugElement.query(By.css('ewms-icon[name="spinner"]'));
      expect(spinner).not.toBeNull();
    });

    it('suppresses (click) and stops native event bubbling to parent during loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      button.click();

      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('suppresses Enter keydown events during loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const buttonDebug = fixture.debugElement.query(By.css('button'));
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      buttonDebug.nativeElement.dispatchEvent(event);

      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('retains focus when entering loading state', async () => {
      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      button.focus();
      expect(document.activeElement).toBe(button);

      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(button);
    });
  });

  describe('Disabled state', () => {
    it('applies native disabled attribute and prevents clicks', async () => {
      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.hasAttribute('aria-disabled')).toBe(false);

      button.click();
      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('keeps the native disabled attribute when disabled and loading are both set', async () => {
      host.disabled.set(true);
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      // `disabled` and `loading` are independent: an explicitly disabled button
      // stays disabled while it loads. Only `aria-busy` is added on top.
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
      // The native attribute already conveys the state; aria-disabled too would
      // announce it twice.
      expect(button.hasAttribute('aria-disabled')).toBe(false);

      button.click();
      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });
  });

  describe('Focus ring', () => {
    it('draws the ring from CSS on :focus-visible, with no inline box-shadow', () => {
      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;

      // The ring is a `:focus-visible` utility backed by --focus-ring-shadow.
      // jsdom resolves neither var() nor :focus-visible, so what is asserted
      // here is the contract that puts the decision in the browser's hands:
      // the class is present and nothing writes box-shadow from TypeScript.
      expect(button.classList.contains('focus-visible:shadow-(--focus-ring-shadow)')).toBe(true);
      expect(button.style.boxShadow).toBe('');

      button.focus();
      expect(button.style.boxShadow).toBe('');
    });
  });

  describe('Icon integration', () => {
    it('renders icon with aria-hidden when icon input is provided', async () => {
      host.icon.set('package');
      host.iconPosition.set('left');
      fixture.detectChanges();
      await fixture.whenStable();

      // Angular inputs are not reflected as HTML attributes; query by directive instead.
      const icons = fixture.debugElement.queryAll(By.directive(Icon));
      expect(icons.length).toBeGreaterThan(0);
      const firstIcon = icons[0];
      if (!firstIcon) throw new Error('No ewms-icon found in template');
      const iconEl = firstIcon.nativeElement as Element;
      // The icon's inner svg carries aria-hidden; the host ewms-icon passes it down.
      expect(iconEl.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Accessibility (axe)', () => {
    const variants: readonly ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];

    it.each(variants)('passes axe accessibility checks for variant "%s"', async (variant) => {
      host.variant.set(variant);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe accessibility checks in loading state', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe accessibility checks in disabled state', async () => {
      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });
  });
});
