import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';
import { isGroup, parentOf, visibleItems, type NavItem } from './navigation.types';

let nextRailId = 0;

/**
 * THE NAVIGATION TREE, AND NOTHING ELSE.
 *
 * It draws items, says which one is current, opens and closes groups, and
 * reports what was chosen. It does not know the router, the real menu, the
 * permissions, or what any route means. The shell knows all four
 * (`projects/shell/src/app/layout/`); this is the piece it draws with.
 *
 * TWO WIDTHS, ONE COMPONENT. Collapsed it is a rail of icons
 * (`--nav-rail-width`); expanded, a panel of icon and label
 * (`--nav-panel-width`). Both numbers come from the App Shell sheet, and
 * neither is written anywhere but tokens.css.
 *
 * EVERY ICON CARRIES A TOOLTIP WHEN THE RAIL IS COLLAPSED, and that is a
 * requirement rather than a nicety: a rail of unlabelled glyphs is unusable
 * for anyone who does not already know the product, and `aria-label` alone
 * serves a screen reader while leaving a sighted person guessing. The tooltip
 * directive already handles the three rules of WCAG 1.4.13, so this reuses it
 * instead of inventing a second hover panel.
 *
 * THE KEYBOARD IS THE APG'S TREEVIEW, deliberately -- the same decision the
 * Table made when it took `treegrid`. One Tab stop for the whole rail, the
 * arrows walk it, Right opens a group and Left closes it or climbs to the
 * parent. A tree of sixteen destinations where Tab visits each one costs
 * sixteen presses to get past the navigation, on every screen.
 */
@Component({
  selector: 'ewms-nav-rail',
  templateUrl: './nav-rail.html',
  imports: [Icon, NgTemplateOutlet, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex' },
})
export class NavRail {
  readonly items = input.required<readonly NavItem[]>();

  /**
   * The name of the landmark, already translated.
   *
   * Required, not defaulted: a page can hold more than one `<nav>` -- this one
   * and the breadcrumbs -- and two unnamed navigation landmarks are
   * indistinguishable in a screen reader's landmark list.
   */
  readonly label = input.required<string>();

  /** Which item is the page you are on. Null while nothing matches. */
  readonly activeId = input<string | null>(null);

  /** Collapsed rail (72) or expanded panel (232). */
  readonly expanded = input<boolean>(true);

  /** A destination was chosen. Groups never emit: they open. */
  readonly itemSelect = output<NavItem>();

  /** The user asked for the other width, from the rail's own control. */
  readonly expandedChange = output<boolean>();

  /** Label of the collapse/expand control, already translated. */
  readonly toggleLabel = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly treeId = `ewms-nav-rail-${++nextRailId}`;

  /** Which groups are open. Uncontrolled: the rail owns its own disclosure. */
  private readonly open = signal<ReadonlySet<string>>(new Set());

  /**
   * The one item in the Tab order (the APG's roving tabindex).
   *
   * Null until something is focusable, which is resolved by `focusTarget`
   * below: the active item when there is one, otherwise the first.
   */
  private readonly focusedId = signal<string | null>(null);

  protected readonly visible = computed(() => visibleItems(this.items(), this.open()));

  /**
   * THE ACTIVE ITEM'S GROUP IS OPENED, AND NOT BY THE CONSUMER.
   *
   * Landing on /catalogos/articulos with "Catálogos" collapsed shows a rail
   * that does not contain the page you are on. Making the shell open it would
   * put tree state in the shell, where the tree is not.
   */
  constructor() {
    effect(() => {
      const active = this.activeId();
      if (active === null) {
        return;
      }
      const parent = parentOf(this.items(), active);
      if (parent !== null && !this.open().has(parent.id)) {
        this.open.update((current) => new Set(current).add(parent.id));
      }
    });
  }

  /** The item that carries `tabindex="0"`. Exactly one, always. */
  protected readonly focusTarget = computed(() => {
    const focused = this.focusedId();
    const visible = this.visible();
    if (focused !== null && visible.some((item) => item.id === focused)) {
      return focused;
    }
    const active = this.activeId();
    if (active !== null && visible.some((item) => item.id === active)) {
      return active;
    }
    return visible[0]?.id ?? null;
  });

  protected isGroup(item: NavItem): boolean {
    return isGroup(item);
  }

  protected isOpen(item: NavItem): boolean {
    return this.open().has(item.id);
  }

  protected onToggleWidth(): void {
    this.expandedChange.emit(!this.expanded());
  }

  /** Clicking a row: a group opens, a destination reports itself. */
  protected onActivate(item: NavItem): void {
    this.focusedId.set(item.id);
    if (isGroup(item)) {
      this.toggle(item);
      return;
    }
    this.itemSelect.emit(item);
  }

  /**
   * The treeview keyboard (WAI-ARIA APG).
   *
   * `Enter` and `Space` are not handled here: every row is a real `<button>`,
   * so the browser already turns both into a click. Re-implementing them would
   * be a second definition of "activate" that could drift from the first.
   */
  protected onKeydown(event: KeyboardEvent, item: NavItem): void {
    const visible = this.visible();
    const index = visible.findIndex((candidate) => candidate.id === item.id);

    switch (event.key) {
      case 'ArrowDown':
        this.moveTo(visible[index + 1]);
        break;
      case 'ArrowUp':
        this.moveTo(visible[index - 1]);
        break;
      case 'Home':
        this.moveTo(visible[0]);
        break;
      case 'End':
        this.moveTo(visible[visible.length - 1]);
        break;
      case 'ArrowRight':
        if (isGroup(item) && !this.isOpen(item)) {
          this.toggle(item);
        } else if (isGroup(item)) {
          // Already open: step into it, which is what the APG asks for.
          this.moveTo(visible[index + 1]);
        }
        break;
      case 'ArrowLeft':
        if (isGroup(item) && this.isOpen(item)) {
          this.toggle(item);
        } else {
          // A child climbs to its group; a top-level leaf has nowhere to go.
          const parent = parentOf(this.items(), item.id);
          if (parent !== null) {
            this.moveTo(parent);
          }
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private toggle(group: NavItem): void {
    this.open.update((current) => {
      const next = new Set(current);
      if (!next.delete(group.id)) {
        next.add(group.id);
      }
      return next;
    });
  }

  /**
   * Move the roving focus, and move the real focus with it.
   *
   * The DOM query is the honest way round: the list is rendered by a `@for`,
   * so the element for an id exists only after the template has drawn it, and
   * holding element references in the component would duplicate that state.
   */
  private moveTo(item: NavItem | undefined): void {
    if (item === undefined) {
      return;
    }
    this.focusedId.set(item.id);
    const selector = `[data-nav-item="${CSS.escape(item.id)}"]`;
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
