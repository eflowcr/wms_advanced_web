import { ChangeDetectionStrategy, Component, computed, HostListener, input } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';
import {
  BUTTON_BASE_CLASSES,
  BUTTON_ICON_SIZES,
  buttonSpinnerColor,
  buttonVariantClasses,
  ICON_BUTTON_SIZE_CLASSES,
  isInteractionBlocked,
  suppressEvent,
  type ButtonSize,
  type ButtonVariant,
} from '../button/button.types';
import { Icon } from '../icon/icon';
import { Tooltip } from '../tooltip/tooltip';

/**
 * A button whose only visible content is an icon. For table rows, dense
 * toolbars, and anywhere text does not fit.
 *
 * NOT A VARIANT OF `ewms-button`, and the reason is types. In a single
 * component `label` would have to be optional -- redundant whenever there is
 * text -- and nothing would then stop `<ewms-button icon="trash" />`, which
 * compiles and has no accessible name. As a separate component `label` is
 * required in the type, so that button does not compile.
 *
 * What the two DO share is the implementation: the same tokens, the same focus
 * ring, the same loading pattern, written once in button.types.ts and reused
 * by both. Two public APIs, one style. They cannot drift.
 *
 * The default variant is `ghost`, not `primary`: this control lives in rows
 * and toolbars, where the correct emphasis is the lowest one. A `primary`
 * default would fill every table row with blue boxes.
 */
@Component({
  selector: 'ewms-icon-button',
  templateUrl: './icon-button.html',
  imports: [Icon, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
})
export class IconButton {
  readonly icon = input.required<IconName>();

  /**
   * Required in the type, without exception: with no text there is no
   * accessible name. A default value would empty the guarantee.
   *
   * The consumer passes it already translated -- the design system speaks no
   * language (ADR 0008).
   */
  readonly label = input.required<string>();

  /**
   * Required as well, and NOT derived from `label`. They usually say the same
   * thing, but generating it would close the case where they must differ:
   * `label="Eliminar"` with `tooltip="Eliminar (no se puede deshacer)"`.
   *
   * Called `tooltip` and not `ewmsTooltip`: the component selector already
   * carries the prefix, so repeating it on every attribute would be noise.
   */
  readonly tooltip = input.required<string>();

  readonly variant = input<ButtonVariant>('ghost');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);

  /**
   * Whether what this button opens is open, and what it opens.
   *
   * INPUTS RATHER THAN ATTRIBUTES ON THE TAG, because `aria-expanded` written
   * on `<ewms-icon-button>` lands on the custom element -- which has no role
   * and is not the thing anybody presses -- while the state belongs on the
   * `<button>` inside. The state was announced nowhere until these existed.
   *
   * Not `ariaExpanded`/`ariaControls`: those are the names of native IDL
   * members, and nothing public here is allowed to shadow one.
   */
  readonly expanded = input<boolean | null>(null);
  readonly controlsId = input<string | null>(null);

  /**
   * Whether this button is a TWO-STATE button, and which state it is in.
   *
   * Added in DS-5 for `ewms-favorite-toggle`, and an input rather than an
   * attribute on the tag for exactly the reason `expanded` is: `aria-pressed`
   * written on `<ewms-icon-button>` lands on the custom element, which has no
   * role and is not what anybody presses.
   *
   * `null` by default, so an ordinary icon button carries no `aria-pressed`
   * at all. A button that always announces "not pressed" is a button a screen
   * reader describes as a toggle when it is not one.
   */
  readonly pressed = input<boolean | null>(null);

  protected readonly baseClasses = BUTTON_BASE_CLASSES;

  protected readonly iconSize = computed(() => BUTTON_ICON_SIZES[this.size()]);

  /**
   * Square. The icon uses the Button's mapping (`sm` at Small, `md` at Medium
   * and Large) rather than a larger one of its own: the two live side by side
   * in the same toolbar, and two icons of different sizes read as a mistake.
   */
  protected readonly boxClass = computed(() => ICON_BUTTON_SIZE_CLASSES[this.size()]);

  protected readonly variantClasses = computed(() =>
    buttonVariantClasses(this.variant(), this.disabled()),
  );

  protected readonly spinnerColor = computed(() => buttonSpinnerColor(this.variant()));

  /**
   * Same rule as the Button: `aria-disabled` marks the loading state only
   * while the native attribute is absent, so the state is never announced
   * twice.
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
