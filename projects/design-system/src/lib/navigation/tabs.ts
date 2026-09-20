import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { Icon } from '../icon/icon';
import { IconButton } from '../icon-button/icon-button';
import type { Tab } from './navigation.types';

export type TabsMode = 'section' | 'document';

let nextTabsId = 0;

/**
 * TWO MODES, ONE COMPONENT, AND THAT IS THE WHOLE DECISION.
 *
 *   `section`   an underlined strip for the sub-sections of one screen.
 *   `document`  the MDI strip of the App Shell: the active tab is a white
 *               card with a shadow, the others are flat grey, and each one
 *               closes.
 *
 * They look nothing alike and they ARE the same control: a list of things, one
 * of which is showing. Two components would be two keyboards, two focus
 * contracts and two sets of ARIA to keep in step, and the day somebody fixed
 * an arrow-key bug they would fix it in one of them.
 *
 * NO `tabpanel` IS RENDERED HERE, and that is not an omission. In the App
 * Shell the panel is the `<router-outlet>`; in a screen it is whatever the
 * consumer draws. A component that owned the panel would own the content, and
 * a document tab's content is a route.
 *
 * The keyboard is the APG's: the strip is one Tab stop, the arrows move
 * between tabs, Home and End jump, and Delete closes the one you are on when
 * it can be closed. Activation follows the focus -- these tabs show something
 * that is already loaded, so there is nothing to pay for moving through them.
 */
@Component({
  selector: 'ewms-tabs',
  templateUrl: './tabs.html',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0' },
})
export class Tabs {
  readonly tabs = input.required<readonly Tab[]>();
  readonly activeId = input<string | null>(null);
  readonly mode = input<TabsMode>('section');

  /**
   * The strip's accessible name, already translated.
   *
   * Required for the same reason the rail's is: a screen with section tabs
   * inside a document tab has two tablists, and "tab list" twice tells a
   * screen-reader user nothing about which is which.
   */
  readonly label = input.required<string>();


  /** Labels for the overflow controls, already translated. */
  readonly scrollBackLabel = input<string>('');
  readonly scrollForwardLabel = input<string>('');

  readonly tabSelect = output<Tab>();
  readonly tabClose = output<Tab>();

  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly listId = `ewms-tabs-${++nextTabsId}`;

  /** Whether the strip is wider than its box, so the arrows have a job. */
  private readonly overflowing = signal(false);

  protected readonly isDocument = computed(() => this.mode() === 'document');
  protected readonly showArrows = computed(() => this.isDocument() && this.overflowing());

  constructor() {
    /*
     * A ResizeObserver and not a window resize listener: the strip narrows
     * when the rail expands, which no window event reports. Created after the
     * first render because there is nothing to observe before it.
     */
    afterNextRender(() => {
      const element = this.strip()?.nativeElement;
      if (element === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => {
        this.overflowing.set(element.scrollWidth > element.clientWidth + 1);
      });
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected isClosable(tab: Tab): boolean {
    // Closable unless it says otherwise: in an MDI strip a tab that cannot be
    // closed is the exception, and the exception is what gets written down.
    return this.isDocument() && tab.closable !== false;
  }

  protected onSelect(tab: Tab): void {
    if (tab.disabled === true) {
      return;
    }
    this.tabSelect.emit(tab);
  }

  /**
   * The mouse's way to close, from the glyph inside the tab.
   *
   * `stopPropagation` because the glyph sits inside the tab button: without
   * it, closing a tab would also select it on the way out.
   */
  protected onCloseGlyph(event: Event, tab: Tab): void {
    event.stopPropagation();
    this.tabClose.emit(tab);
  }

  /**
   * The APG's tab keyboard.
   *
   * `Delete` closes the tab you are on. It is the only destructive key here
   * and it is guarded twice: the tab has to be closable, and a tab is only
   * closable in `document` mode -- a section is not something you close.
   */
  protected onKeydown(event: KeyboardEvent, tab: Tab): void {
    const tabs = this.tabs().filter((candidate) => candidate.disabled !== true);
    const index = tabs.findIndex((candidate) => candidate.id === tab.id);

    switch (event.key) {
      case 'ArrowRight':
        this.focusAndSelect(tabs[(index + 1) % tabs.length]);
        break;
      case 'ArrowLeft':
        this.focusAndSelect(tabs[(index - 1 + tabs.length) % tabs.length]);
        break;
      case 'Home':
        this.focusAndSelect(tabs[0]);
        break;
      case 'End':
        this.focusAndSelect(tabs[tabs.length - 1]);
        break;
      case 'Delete':
        if (this.isClosable(tab)) {
          this.tabClose.emit(tab);
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected scrollBy(direction: -1 | 1): void {
    const element = this.strip()?.nativeElement;
    if (element === undefined) {
      return;
    }
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  }

  private focusAndSelect(tab: Tab | undefined): void {
    if (tab === undefined) {
      return;
    }
    this.tabSelect.emit(tab);
    const selector = `[data-tab="${CSS.escape(tab.id)}"]`;
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
