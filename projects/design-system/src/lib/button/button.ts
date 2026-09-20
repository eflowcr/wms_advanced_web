import { ChangeDetectionStrategy, Component, computed, HostListener, input } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';
import { Icon } from '../icon/icon';
import {
  BUTTON_BASE_CLASSES,
  BUTTON_FONT_SIZES,
  BUTTON_HEIGHT_CLASSES,
  BUTTON_ICON_SIZES,
  BUTTON_PADDING_CLASSES,
  buttonSpinnerColor,
  buttonVariantClasses,
  isInteractionBlocked,
  suppressEvent,
  type ButtonIconPosition,
  type ButtonSize,
  type ButtonVariant,
} from './button.types';

export type { ButtonIconPosition, ButtonSize, ButtonVariant } from './button.types';

let nextButtonId = 0;

/**
 * Primary action button for the design system.
 *
 * Implements accessible loading states (retaining focus and accessible name),
 * token-based variant styling, and strict event suppression during loading/disabled states.
 *
 * The visual implementation is shared with `ewms-icon-button` through
 * button.types.ts: two public APIs, one style.
 */
@Component({
  selector: 'ewms-button',
  templateUrl: './button.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class Button {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly icon = input<IconName | null>(null);
  readonly iconPosition = input<ButtonIconPosition>('left');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);

  /**
   * WHETHER THIS BUTTON SUBMITS THE FORM IT IS IN. Default `'button'`, which
   * means nothing that exists changes.
   *
   * The Button rendered `type="button"` unconditionally until DS-5, and that
   * was deliberate: a button that submits without anybody asking is a whole
   * class of defect this system does not have. It also had a cost, found by
   * building the example screen of DS-4 and written down as a pending decision
   * on the Button's own sheet: A FORM WITH NO SUBMIT BUTTON IS NOT SENT BY
   * `Enter` EITHER. The browser's implicit submission needs a submit button to
   * exist, so every multi-field form in this system could only be saved by
   * clicking or by Ctrl+S -- and `Enter` in a field, which is what everybody
   * does, did nothing at all.
   *
   * So submitting stays something somebody writes on purpose; it is now
   * possible to write it. `type="submit"` inside a `<form>` gives back the
   * browser's own behaviour, `Enter` included, and the anti-double-submit
   * pattern is unchanged: `loading` blocks the second press exactly as it
   * blocks the second click.
   */
  readonly type = input<'button' | 'submit'>('button');

  protected readonly contentId = `ewms-btn-content-${++nextButtonId}`;

  protected readonly baseClasses = BUTTON_BASE_CLASSES;

  protected readonly iconSize = computed(() => BUTTON_ICON_SIZES[this.size()]);
  protected readonly fontSize = computed(() => BUTTON_FONT_SIZES[this.size()]);

  protected readonly heightClass = computed(() => BUTTON_HEIGHT_CLASSES[this.size()]);
  protected readonly paddingClass = computed(() => BUTTON_PADDING_CLASSES[this.size()]);

  protected readonly hasLeftIcon = computed(
    () => Boolean(this.icon()) && this.iconPosition() === 'left',
  );
  protected readonly hasRightIcon = computed(
    () => Boolean(this.icon()) && this.iconPosition() === 'right',
  );

  protected readonly variantClasses = computed(() =>
    buttonVariantClasses(this.variant(), this.disabled()),
  );

  protected readonly spinnerColor = computed(() => buttonSpinnerColor(this.variant()));

  /**
   * `aria-disabled` marks the loading state only while the native attribute is
   * absent. With `disabled` set the native attribute already conveys it, and
   * carrying both would announce the state twice.
   */
  protected readonly ariaDisabled = computed(() =>
    this.loading() && !this.disabled() ? 'true' : null,
  );

  @HostListener('click', ['$event'])
  protected onHostClick(event: MouseEvent): void {
    if (isInteractionBlocked(this.disabled(), this.loading())) {
      suppressEvent(event);
    }
  }

  protected onButtonClick(event: MouseEvent): void {
    if (isInteractionBlocked(this.disabled(), this.loading())) {
      suppressEvent(event);
    }
  }

  protected onButtonKeydown(event: KeyboardEvent): void {
    if (this.loading() && (event.key === 'Enter' || event.key === ' ')) {
      suppressEvent(event);
    }
  }
}
