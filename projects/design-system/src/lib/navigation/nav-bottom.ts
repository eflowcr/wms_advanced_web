import { FocusTrapFactory, type FocusTrap } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';
import { isGroup, type NavItem } from './navigation.types';

/**
 * How many destinations fit across the bottom of a phone before the labels
 * stop being readable. Four at the narrowest width the system supports, with
 * a `text-caption` label under a `size-icon-lg` glyph; a fifth slot is what
 * the «more» control is.
 */
export const BOTTOM_NAV_SLOTS = 4;

/**
 * THE NAVIGATION ON A NARROW SCREEN: A BOTTOM BAR.
 *
 * DECISIÓN DEL USUARIO (2026-09-19). The frente proposed an overlay drawer and
 * argued against a bottom bar; the user chose the bottom bar, and this is it,
 * built as asked with the cost written down rather than hidden:
 *
 *   THE COST. A bottom bar carries three to five first-level destinations.
 *   This menu has four at the first level and TWELVE at the second (Catálogos
 *   has ten children, Configuración three). Those twelve are therefore TWO
 *   TAPS away, behind «Más» or behind their group -- one tap more than on the
 *   rail, on every one of them, on the device where taps are most expensive.
 *
 * What is NOT compromised is the keyboard and the focus. The sheet that holds
 * the rest of the tree traps focus while it is open, closes on Escape, and
 * gives the focus back to the control that opened it. A panel that drops the
 * focus on the body makes somebody tab through the whole page to get back.
 *
 * The CDK's `FocusTrap` directly, and NOT `DialogService`: this is a panel
 * attached to the bar, not a modal. Opening it as a dialog would give it
 * `role="dialog"`, the backdrop blur and the modal's geometry, which is not
 * what it is, and would make the navigation of the application a dialog.
 */
@Component({
  selector: 'ewms-nav-bottom',
  templateUrl: './nav-bottom.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*
   * ESCAPE IS ANSWERED ON THE HOST, NOT ON THE SHEET.
   *
   * A `(keydown)` on the sheet's own `<div>` is an interaction handler on
   * something that is not focusable, which the template lint rule rejects and
   * is right to: an element that answers input a keyboard cannot reach is
   * usually a bug. Here the element is a CONTAINER -- what has the focus is
   * whatever is inside it -- so the listener belongs one level up, on the
   * host, where the event has bubbled to by the time anybody sees it.
   */
  host: { class: 'contents', '(keydown)': 'onSheetKeydown($event)' },
})
export class NavBottom {
  readonly items = input.required<readonly NavItem[]>();

  /** The landmark's name, already translated. */
  readonly label = input.required<string>();

  /** The sheet's heading and the «more» control's name, already translated. */
  readonly moreLabel = input.required<string>();
  readonly closeLabel = input.required<string>();

  readonly activeId = input<string | null>(null);

  readonly itemSelect = output<NavItem>();

  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  private readonly focusTraps = inject(FocusTrapFactory);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private trap: FocusTrap | null = null;
  /** What to give the focus back to. Never guessed: it is remembered. */
  private opener: HTMLElement | null = null;

  protected readonly open = signal(false);

  constructor() {
    // ONCE, here, and not on every open: registering the teardown inside the
    // click handler adds a callback per opening and keeps every trap alive.
    this.destroyRef.onDestroy(() => this.trap?.destroy());
  }

  /**
   * What the bar shows, and what the sheet holds.
   *
   * A first-level GROUP never goes on the bar: tapping it on the bar would
   * have to open something anyway, so it would be «Más» wearing its own name.
   * The bar carries destinations; the sheet carries the tree.
   */
  protected readonly barItems = computed(() =>
    this.items()
      .filter((item) => !isGroup(item))
      .slice(0, BOTTOM_NAV_SLOTS),
  );

  /** Whether anything at all is left over for the sheet. */
  protected readonly hasMore = computed(
    () => this.barItems().length < this.items().length || this.items().some(isGroup),
  );

  protected isGroup(item: NavItem): boolean {
    return isGroup(item);
  }

  protected onBarSelect(item: NavItem): void {
    this.itemSelect.emit(item);
  }

  /** From inside the sheet: choose a destination and close behind you. */
  protected onSheetSelect(item: NavItem): void {
    if (isGroup(item)) {
      return;
    }
    this.itemSelect.emit(item);
    this.close();
  }

  protected onOpen(event: Event): void {
    this.opener = event.currentTarget as HTMLElement;
    this.open.set(true);

    /*
     * `afterNextRender` AND NOT `queueMicrotask`, and the difference is the
     * whole feature.
     *
     * At the moment this click is handled, `@if (open())` has not drawn the
     * sheet: `this.sheet()` is undefined and the trap is never built. A
     * microtask is not late enough either -- zoneless Angular renders on its
     * own schedule, not at the end of the current task -- so the first version
     * of this silently did nothing, the focus stayed on «Más», and the panel
     * was operable only because Escape is handled on the host. Found by
     * opening it at 375 px and asking where the focus was.
     *
     * `afterNextRender` is the framework's answer to "when is the DOM there?",
     * and it needs an injector because this is not an injection context.
     */
    afterNextRender(
      () => {
        const element = this.sheet()?.nativeElement;
        if (element === undefined) {
          return;
        }
        this.trap = this.focusTraps.create(element);
        void this.trap.focusFirstTabbableElementWhenReady();
      },
      { injector: this.injector },
    );
  }

  /** Escape, the close control, or the backdrop. All three, one path. */
  protected close(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.trap?.destroy();
    this.trap = null;
    this.opener?.focus();
    this.opener = null;
  }

  protected onSheetKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }
}
