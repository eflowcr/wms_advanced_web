import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, type IconName } from '../../icons/icons.generated';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

/** Tamaño y trazo juntos: el trazo se compensa por tamaño en tokens.css. */
const SIZE_CLASSES: Readonly<Record<IconSize, string>> = {
  sm: 'size-icon-sm stroke-icon-sm',
  md: 'size-icon-md stroke-icon-md',
  lg: 'size-icon-lg stroke-icon-lg',
  xl: 'size-icon-xl stroke-icon-xl',
};

/**
 * Única vía para un icono (ADR 0011): geometría como dato, sin innerHTML; color por
 * `currentColor`. Sin `label` es decorativo; con `label`, `role="img"` con ese nombre.
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
