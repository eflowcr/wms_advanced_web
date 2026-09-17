import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, type IconName } from '../../icons/icons.generated';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Width/height and stroke width always travel together: the stroke is
 * compensated per size in tokens.css (--size-icon-* / --stroke-icon-*).
 */
const SIZE_CLASSES: Readonly<Record<IconSize, string>> = {
  sm: 'size-icon-sm stroke-icon-sm',
  md: 'size-icon-md stroke-icon-md',
  lg: 'size-icon-lg stroke-icon-lg',
  xl: 'size-icon-xl stroke-icon-xl',
};

/**
 * The one way to put an icon on screen (ADR 0011).
 *
 * The geometry is data: the template walks the primitives and binds each
 * attribute. No innerHTML, no DomSanitizer, so an icon can never carry markup.
 *
 * Colour is always `currentColor`. The icon inherits from its container and
 * never sets a colour of its own; one that needs a colour gets it from the
 * container.
 *
 * Accessibility is decided by whether the icon carries information:
 *   - no `label` (default): decorative. aria-hidden, not focusable. Correct
 *     whenever a visible text next to it already says the same thing.
 *   - `label`: role="img" with that aria-label. The text comes from the
 *     consumer, never from here, so it is translated where it is used.
 *
 * No `styles`/`styleUrl` (ADR 0010): sizing is Tailwind utilities backed by
 * the icon tokens.
 */
@Component({
  selector: 'ewms-icon',
  templateUrl: './icon.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>('md');
  readonly label = input<string | undefined>(undefined);

  protected readonly primitives = computed(() => ICONS[this.name()]);
  protected readonly sizeClass = computed(() => SIZE_CLASSES[this.size()]);
  protected readonly informative = computed(() => Boolean(this.label()));
}
