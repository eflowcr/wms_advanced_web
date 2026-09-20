import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import { Tooltip } from './tooltip';
import { TOOLTIP_POINTER_GRACE_MS, TOOLTIP_SHOW_DELAY_MS, type TooltipPosition } from './tooltip.types';

@Component({
  template: `
    <button
      type="button"
      id="trigger"
      [attr.aria-label]="ariaLabel()"
      [ewmsTooltip]="text()"
      [position]="position()"
      [describes]="describes()"
      [tooltipDisabled]="tooltipDisabled()"
      [disabled]="nativeDisabled()"
    >
      Trigger
    </button>
    <button type="button" id="other" [ewmsTooltip]="'Otro'">Other</button>
  `,
  imports: [Tooltip],
})
class TestHost {
  readonly text = signal('Eliminar');
  readonly position = signal<TooltipPosition>('top');
  readonly describes = signal(false);
  readonly tooltipDisabled = signal(false);
  readonly nativeDisabled = signal(false);
  readonly ariaLabel = signal<string | null>(null);
}

/**
 * The tooltip panel lives in the CDK overlay container, which is appended to
 * document.body -- outside the fixture's own element.
 */
function panels(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.cdk-overlay-container div[id^="ewms-tooltip-"]'));
}

function panel(): HTMLElement | null {
  return panels()[0] ?? null;
}

describe('Tooltip', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let trigger: HTMLButtonElement;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [TestHost, Tooltip],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();

    trigger = fixture.debugElement.query(By.css('#trigger')).nativeElement as HTMLButtonElement;
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  function hover(element: Element): void {
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  }

  function unhover(element: Element): void {
    element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
  }

  function showByHover(): void {
    hover(trigger);
    vi.advanceTimersByTime(TOOLTIP_SHOW_DELAY_MS);
    fixture.detectChanges();
  }

  describe('Triggers', () => {
    it('appears on hover, after the show delay and not before', () => {
      hover(trigger);
      vi.advanceTimersByTime(TOOLTIP_SHOW_DELAY_MS - 1);
      expect(panel()).toBeNull();

      vi.advanceTimersByTime(1);
      expect(panel()?.textContent).toBe('Eliminar');
    });

    it('appears on keyboard focus, with no delay', () => {
      trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      // No timer advance at all: focus is deliberate, it does not wait.
      expect(panel()?.textContent).toBe('Eliminar');
    });

    it('closes on focus loss with no delay', () => {
      trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(panel()).not.toBeNull();

      trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      expect(panel()).toBeNull();
    });

    it('does not appear at all when disabled', () => {
      host.tooltipDisabled.set(true);
      fixture.detectChanges();

      showByHover();
      expect(panel()).toBeNull();

      trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(panel()).toBeNull();
    });

    it('leaves the host control native [disabled] alone', () => {
      // The whole reason the directive's own switch is called tooltipDisabled
      // and not disabled. An input named `disabled` would capture this binding
      // and the button would render enabled while looking disabled -- silent,
      // and on the one attribute where silence is worst.
      host.nativeDisabled.set(true);
      fixture.detectChanges();

      expect(trigger.disabled).toBe(true);

      // ...and the two switches stay independent in the other direction too.
      host.nativeDisabled.set(false);
      host.tooltipDisabled.set(true);
      fixture.detectChanges();

      expect(trigger.disabled).toBe(false);
      showByHover();
      expect(panel()).toBeNull();
    });

    it('shows only one tooltip at a time', () => {
      showByHover();
      expect(panels()).toHaveLength(1);

      const other = fixture.debugElement.query(By.css('#other')).nativeElement as HTMLElement;
      hover(other);
      vi.advanceTimersByTime(TOOLTIP_SHOW_DELAY_MS);
      fixture.detectChanges();

      expect(panels()).toHaveLength(1);
      expect(panel()?.textContent).toBe('Otro');
    });
  });

  describe('WCAG 2.2 1.4.13', () => {
    it('is persistent: it never closes on its own while the pointer rests on the control', () => {
      showByHover();
      expect(panel()).not.toBeNull();

      // Ten seconds of wall clock with no further interaction. A tooltip that
      // disappears on a timer fails "Persistent"; this is the assertion that
      // would catch a setTimeout-based auto-dismiss being added later.
      vi.advanceTimersByTime(10_000);
      fixture.detectChanges();

      expect(panel()).not.toBeNull();
    });

    it('is hoverable: the pointer can leave the control and enter the tooltip', () => {
      showByHover();
      const open = panel();
      expect(open).not.toBeNull();

      // Pointer leaves the control and lands on the panel within the grace
      // period, which is travel time and not a lifetime.
      unhover(trigger);
      hover(open!);
      vi.advanceTimersByTime(TOOLTIP_POINTER_GRACE_MS);
      fixture.detectChanges();

      expect(panel()).not.toBeNull();

      // It stays open for as long as the pointer is on it.
      vi.advanceTimersByTime(10_000);
      expect(panel()).not.toBeNull();

      // And closes once the pointer leaves the panel too.
      unhover(open!);
      vi.advanceTimersByTime(TOOLTIP_POINTER_GRACE_MS);
      fixture.detectChanges();

      expect(panel()).toBeNull();
    });

    it('closes when the pointer leaves the control without reaching the tooltip', () => {
      showByHover();
      expect(panel()).not.toBeNull();

      unhover(trigger);
      vi.advanceTimersByTime(TOOLTIP_POINTER_GRACE_MS);
      fixture.detectChanges();

      expect(panel()).toBeNull();
    });

    it('is dismissible: Escape closes it and the focus stays where it was', () => {
      trigger.focus();
      trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(panel()).not.toBeNull();
      expect(document.activeElement).toBe(trigger);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(panel()).toBeNull();
      // Dismissed without moving the focus: it is still on the control.
      expect(document.activeElement).toBe(trigger);
    });

    it('is dismissible with Escape even when it was opened by hover and the focus is elsewhere', () => {
      showByHover();
      expect(panel()).not.toBeNull();
      expect(document.activeElement).not.toBe(trigger);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(panel()).toBeNull();
    });
  });

  describe('The duplicated name', () => {
    it('hides the panel from assistive technology when describes is false', () => {
      showByHover();

      expect(panel()?.getAttribute('aria-hidden')).toBe('true');
      expect(panel()?.hasAttribute('role')).toBe(false);
      // Nothing points at it: the control's own name is announced once.
      expect(trigger.hasAttribute('aria-describedby')).toBe(false);
    });

    it('connects the panel with aria-describedby when describes is true', () => {
      host.describes.set(true);
      fixture.detectChanges();
      showByHover();

      const open = panel();
      expect(open).not.toBeNull();
      expect(open?.getAttribute('role')).toBe('tooltip');
      expect(open?.hasAttribute('aria-hidden')).toBe(false);
      expect(trigger.getAttribute('aria-describedby')).toBe(open?.id);
    });

    it('drops aria-describedby again when the tooltip closes', () => {
      host.describes.set(true);
      fixture.detectChanges();
      showByHover();
      expect(trigger.hasAttribute('aria-describedby')).toBe(true);

      unhover(trigger);
      vi.advanceTimersByTime(TOOLTIP_POINTER_GRACE_MS);
      fixture.detectChanges();

      expect(trigger.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('Content', () => {
    it('renders the text as text, never as markup', () => {
      host.text.set('<img src="x" onerror="alert(1)">');
      fixture.detectChanges();
      showByHover();

      const open = panel();
      expect(open?.textContent).toBe('<img src="x" onerror="alert(1)">');
      expect(open?.querySelector('img')).toBeNull();
    });

    it('reflects a text change while open', () => {
      showByHover();
      expect(panel()?.textContent).toBe('Eliminar');

      host.text.set('Eliminar definitivamente');
      fixture.detectChanges();

      expect(panel()?.textContent).toBe('Eliminar definitivamente');
    });

    it('closes when the directive is disabled while open', () => {
      showByHover();
      expect(panel()).not.toBeNull();

      host.tooltipDisabled.set(true);
      fixture.detectChanges();

      expect(panel()).toBeNull();
    });

    it('leaves nothing behind when the host is destroyed', () => {
      showByHover();
      expect(panel()).not.toBeNull();

      fixture.destroy();

      expect(panel()).toBeNull();
    });
  });

  describe('Accessibility (axe)', () => {
    /**
     * axe-core schedules its own work on real timers, so it never resolves
     * while they are faked. The tooltip is driven to the state under test with
     * the fake clock, and the clock is handed back before axe runs.
     *
     * The fixture and the panel are scanned as two roots rather than scanning
     * document.body, because the panel is NOT inside the fixture: the CDK
     * appends its overlay container straight to the body.
     *
     * Scanning the body instead would report `region` ("all page content
     * should be contained by landmarks") against `.cdk-overlay-container`.
     * That is a page-structure rule -- a component fixture has no <main> or
     * <nav> to be contained by -- and it is axe best-practice, not WCAG A/AA.
     * It is worth knowing that a real page WILL report it while a tooltip is
     * open, since the overlay container is a sibling of the landmarks rather
     * than a child; that belongs to whoever assembles the page, not here.
     */
    async function axeOnRealTimers(): Promise<void> {
      vi.useRealTimers();
      await expectNoAxeViolations(fixture.nativeElement);
      const open = panel();
      if (open) {
        await expectNoAxeViolations(open);
      }
    }

    it('passes axe with the tooltip closed', async () => {
      expect(panel()).toBeNull();
      await axeOnRealTimers();
    });

    it('passes axe with the tooltip open and describes false', async () => {
      showByHover();
      expect(panel()).not.toBeNull();

      await axeOnRealTimers();
    });

    it('passes axe with the tooltip open and describes true', async () => {
      host.describes.set(true);
      host.ariaLabel.set('Eliminar el articulo');
      fixture.detectChanges();
      showByHover();
      expect(panel()).not.toBeNull();

      await axeOnRealTimers();
    });
  });
});
