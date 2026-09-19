import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { Icon } from '../icon/icon';
import { CardGroup } from './card-group';
import {
  CARD_BASE_CLASSES,
  CARD_SELECTABLE_CLASSES,
  cardSelectableClasses,
  type CardGroupMember,
} from './card.types';

/**
 * Two uses under one name, exactly as the sheet describes them.
 *
 *   - Inside an `ewms-card-group`: an OPTION. It takes a role, a tab position
 *     and the arrow keys from the group, and draws itself chosen or not.
 *   - Anywhere else: a CONTAINER. Header, body and footer, no state of its
 *     own, not interactive, not a tab stop.
 *
 * WHICH ONE IT IS COMES FROM WHERE IT IS WRITTEN, NOT FROM AN INPUT. A
 * `selectable` flag would let `<ewms-card selectable>` exist outside a group,
 * which is a radio with nothing to be a radio in -- an element with
 * `role="radio"` and no `radiogroup` around it, which is invalid and which axe
 * reports. Asking the injector removes the possibility instead of documenting
 * it away.
 */
@Component({
  selector: 'ewms-card',
  templateUrl: './card.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class Card implements CardGroupMember, OnDestroy {
  /**
   * What this card is worth when it is the chosen one. Meaningless outside a
   * group, and ignored there.
   *
   * Not called `value`: `value` is the group's, and the group is the thing a
   * form binds to. Two members called `value` in one component tree is how a
   * reader ends up binding the wrong one.
   */
  readonly optionValue = input<unknown>(null);

  /** This card's own disabled input. The group's is OR-ed in, never subtracted. */
  readonly disabled = input<boolean>(false);

  /**
   * The group this card belongs to, or null when it is a plain container.
   *
   * `self: false` on purpose -- the group is an ancestor component, not this
   * element. `optional: true` is what makes the container case legal.
   */
  private readonly group = inject(CardGroup, { optional: true });

  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');

  protected readonly inGroup = computed(() => this.group !== null);

  /** Quien deshabilita gana: the card's own input, or the group's. */
  readonly ownDisabled = this.disabled;

  protected readonly isDisabled = computed(() =>
    this.group ? this.group.memberDisabled(this) : false,
  );

  protected readonly selected = computed(
    () => this.group !== null && this.group.selectedValue() === this.optionValue(),
  );

  /**
   * One tab stop for the whole group, and this is where it lands. Everything
   * else in the group is reachable with the arrows and nowhere else.
   */
  protected readonly tabIndex = computed<number | null>(() => {
    if (!this.group || this.isDisabled()) {
      return null;
    }
    return this.group.tabbableValue() === this.optionValue() ? 0 : -1;
  });

  protected readonly classes = computed(() => {
    if (!this.inGroup()) {
      return `${CARD_BASE_CLASSES} bg-surface border-default text-primary`;
    }
    return [
      CARD_BASE_CLASSES,
      CARD_SELECTABLE_CLASSES,
      cardSelectableClasses(this.selected(), this.isDisabled()),
    ].join(' ');
  });

  constructor() {
    this.group?.register(this);
  }

  ngOnDestroy(): void {
    this.group?.unregister(this);
  }

  focus(): void {
    this.box().nativeElement.focus();
  }

  protected onClick(): void {
    if (this.isDisabled()) {
      return;
    }
    this.group?.select(this.optionValue());
  }

  /**
   * The arrow keys and Space, as a radio group answers them.
   *
   * `Enter` is deliberately absent. In a radio group Enter belongs to the form
   * around it -- it submits -- and swallowing it here would break the one
   * gesture that makes a keyboard-driven form fast.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (!this.group || this.isDisabled()) {
      return;
    }
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        this.group.move(1);
        return;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.group.move(-1);
        return;
      case ' ':
        // Space scrolls the page by default, which is the last thing a person
        // choosing an option wants.
        event.preventDefault();
        this.group.select(this.optionValue());
        return;
      default:
        return;
    }
  }
}
