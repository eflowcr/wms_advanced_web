import { type OverlayRef } from '@angular/cdk/overlay';
import { DomPortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  Directive,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  type OnDestroy,
} from '@angular/core';
import { createConnectedOverlay } from '../overlay/connected-overlay';
import {
  TOOLTIP_CLASSES,
  TOOLTIP_POINTER_GRACE_MS,
  TOOLTIP_POSITIONS,
  TOOLTIP_SHOW_DELAY_MS,
  type TooltipPosition,
} from './tooltip.types';

export type { TooltipPosition } from './tooltip.types';

let nextTooltipId = 0;

/**
 * The tooltip that is currently open, anywhere on the page.
 *
 * One at a time: opening a tooltip closes the previous one. Module scope is
 * what makes that true across unrelated instances -- the buttons in a toolbar
 * know nothing about each other.
 */
let openTooltip: Tooltip | null = null;

/** Registers `instance` as the open one and returns whoever held the slot. */
function claimSingleton(instance: Tooltip): Tooltip | null {
  const previous = openTooltip;
  openTooltip = instance;
  return previous;
}

/** Gives the slot up, but only if `instance` is still the one holding it. */
function releaseSingleton(instance: Tooltip): void {
  if (openTooltip === instance) {
    openTooltip = null;
  }
}

/**
 * Short descriptive text shown next to a control on hover and on keyboard
 * focus.
 *
 * A DIRECTIVE, not a component: it goes onto an element that already exists
 * rather than wrapping it. It has no template -- the panel is built as a DOM
 * node and handed to a CDK overlay.
 *
 * A TOOLTIP IS NOT AN ACCESSIBLE NAME. It describes; it does not name. Someone
 * navigating with a keyboard may never see it, and on a touch screen there is
 * no hover at all, so a control whose only name is its tooltip has no name.
 * That is why `ewms-icon-button` requires `label` on top of `tooltip`.
 *
 * WCAG 2.2 1.4.13 (Content on Hover or Focus, AA) imposes three things, all
 * three implemented here as requirements and not as refinements:
 *
 *   - Dismissible: Escape closes it without moving the pointer or the focus.
 *   - Hoverable:   the pointer can travel into the tooltip without closing it.
 *   - Persistent:  it stays until the pointer leaves, the focus goes, or
 *                  Escape. It NEVER closes on a timer.
 *
 * The selector is prefixed on purpose. A bare `[tooltip]` is a global
 * attribute selector generic enough to collide with any other library or with
 * a screen's own attribute. Design-system components expose an input called
 * `tooltip` and apply this directive internally, where the component selector
 * already carries the prefix.
 */
@Directive({
  selector: '[ewmsTooltip]',
})
export class Tooltip implements OnDestroy {
  /**
   * The text, already translated by the consumer: the design system speaks no
   * language (ADR 0008).
   */
  readonly text = input.required<string>({ alias: 'ewmsTooltip' });

  readonly position = input<TooltipPosition>('top');

  /**
   * Whether the text ADDS information that the accessible name does not
   * already give.
   *
   * `false` (the default) is the duplicated-name case, which is the Icon
   * Button's: `label` and `tooltip` both say "Eliminar". Connecting that with
   * `aria-describedby` would make a screen reader announce it twice, so the
   * panel goes `aria-hidden` and exists only for people who can see it.
   *
   * `true` connects it with `aria-describedby` and it is announced as a
   * description.
   *
   * The directive does not guess: the consumer declares it.
   */
  readonly describes = input<boolean>(false);

  /**
   * Suppresses the tooltip in one context without removing the directive.
   *
   * NOT called `disabled`, and the name is load-bearing. This directive is
   * applied to controls -- that is its whole purpose -- and `disabled` is a
   * property of every native control. An input by that name captures the
   * `[disabled]` binding on its own host: Angular resolves the binding to the
   * DIRECTIVE input, the native attribute is never written, and the control
   * ends up looking disabled while staying perfectly clickable. It fails
   * silently, on the one attribute where failing silently is worst.
   *
   * The prefix keeps the two apart, so a consumer writes `[disabled]` for the
   * control and `[tooltipDisabled]` for the tooltip, and both land where they
   * read as if they land.
   */
  readonly tooltipDisabled = input<boolean>(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  private readonly panelId = `ewms-tooltip-${++nextTooltipId}`;

  private overlayRef: OverlayRef | null = null;
  private panel: HTMLElement | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pointerInsidePanel = false;

  constructor() {
    // Turning the directive off mid-flight closes what is already open, and a
    // text change while open is reflected instead of left stale.
    effect(() => {
      if (this.tooltipDisabled()) {
        this.hide();
        return;
      }
      const text = this.text();
      if (this.panel) {
        this.panel.textContent = text;
      }
    });
  }

  ngOnDestroy(): void {
    this.hide();
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  // -------------------------------------------------------------- triggers

  @HostListener('mouseenter')
  protected onMouseEnter(): void {
    this.scheduleShow();
  }

  @HostListener('mouseleave')
  protected onMouseLeave(): void {
    this.cancelShow();
    this.schedulePointerHide();
  }

  /**
   * The bubbling focusin/focusout pair rather than the non-bubbling one, so
   * the directive also works on a wrapper whose focusable element is a
   * descendant.
   *
   * Focus never waits for the show delay. Keyboard navigation is deliberate --
   * there is no sweeping past a control with the Tab key.
   */
  @HostListener('focusin')
  protected onFocusIn(): void {
    this.show();
  }

  @HostListener('focusout')
  protected onFocusOut(): void {
    this.hide();
  }

  // ---------------------------------------------------------------- timing

  private scheduleShow(): void {
    if (this.tooltipDisabled() || this.showTimer) {
      return;
    }
    this.cancelHide();
    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      this.show();
    }, TOOLTIP_SHOW_DELAY_MS);
  }

  private cancelShow(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  /**
   * Close once the pointer has left BOTH the control and the panel.
   *
   * The grace period is travel time, not a lifetime: a tooltip the pointer is
   * resting on never closes. Entering the panel cancels this.
   */
  private schedulePointerHide(): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.pointerInsidePanel) {
        this.hide();
      }
    }, TOOLTIP_POINTER_GRACE_MS);
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  // -------------------------------------------------------- show and hide

  private show(): void {
    if (this.tooltipDisabled() || this.overlayRef?.hasAttached()) {
      return;
    }
    this.cancelShow();
    this.cancelHide();

    // Claim the slot first: the previous tooltip's own hide() then finds the
    // slot already taken and leaves it alone.
    const previous = claimSingleton(this);
    if (previous && previous !== this) {
      previous.hide();
    }

    const overlayRef = (this.overlayRef ??= this.createOverlay());
    overlayRef.attach(new DomPortal(this.buildPanel()));

    if (this.describes()) {
      this.host.nativeElement.setAttribute('aria-describedby', this.panelId);
    }

    // Escape has to work even when the tooltip was opened by hover and the
    // focus is somewhere else entirely, so the listener goes on the document
    // and not on the host.
    this.document.addEventListener('keydown', this.onDocumentKeydown, true);
  }

  private hide(): void {
    this.cancelShow();
    this.cancelHide();
    this.pointerInsidePanel = false;

    this.document.removeEventListener('keydown', this.onDocumentKeydown, true);
    this.host.nativeElement.removeAttribute('aria-describedby');

    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.releasePanel();

    releaseSingleton(this);
  }

  /**
   * Escape dismisses without moving the pointer or the focus: nothing in this
   * path calls `focus()` or `blur()`.
   */
  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hide();
    }
  };

  // ----------------------------------------------------------------- panel

  /**
   * The positions are the tooltip's; the strategy is shared with the Select's
   * panel (overlay/connected-overlay.ts). Only the list of placements differs,
   * so only the list lives here.
   */
  private createOverlay(): OverlayRef {
    return createConnectedOverlay(
      this.injector,
      this.host.nativeElement,
      TOOLTIP_POSITIONS[this.position()],
    );
  }

  private buildPanel(): HTMLElement {
    // A DomPortal moves an existing node and puts a comment anchor where it
    // came from, so the node must already have a parent. This holder is that
    // parent and never enters the document: it exists so the CDK has somewhere
    // to hand the panel back to on detach.
    const holder = this.document.createElement('div');
    const panel = this.document.createElement('div');
    holder.appendChild(panel);

    panel.id = this.panelId;
    panel.className = TOOLTIP_CLASSES;
    // textContent, never innerHTML: a tooltip can therefore never carry markup.
    panel.textContent = this.text();

    if (this.describes()) {
      panel.setAttribute('role', 'tooltip');
    } else {
      // The control's own label already gives the name; announcing the panel
      // as well would say it twice.
      panel.setAttribute('aria-hidden', 'true');
    }

    panel.addEventListener('mouseenter', this.onPanelMouseEnter);
    panel.addEventListener('mouseleave', this.onPanelMouseLeave);

    this.panel = panel;
    return panel;
  }

  private releasePanel(): void {
    if (!this.panel) {
      return;
    }
    this.panel.removeEventListener('mouseenter', this.onPanelMouseEnter);
    this.panel.removeEventListener('mouseleave', this.onPanelMouseLeave);
    this.panel.remove();
    this.panel = null;
  }

  private readonly onPanelMouseEnter = (): void => {
    this.pointerInsidePanel = true;
    this.cancelHide();
  };

  private readonly onPanelMouseLeave = (): void => {
    this.pointerInsidePanel = false;
    this.schedulePointerHide();
  };
}
