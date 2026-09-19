import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Which ground a demo sits on. */
export type DemoGround = 'canvas' | 'surface' | 'navy';

/**
 * Widget 5.4 — the demo frame. Sounds trivial; it is what makes every page of
 * the catalogue look like one thing.
 *
 * Three grounds, because some tokens can only be judged on the right one.
 * `navy` exists for the rail: `--color-text-on-dark` and
 * `--color-focus-ring-on-dark` say nothing on white.
 *
 * Built by hand from tokens, like the rest of the chrome, and never out of
 * design-system components: a broken Button must break its own demo and
 * nothing else (Showroom spec, section 5).
 */
@Component({
  selector: 'ewms-demo-frame',
  templateUrl: './demo-frame.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoFrame {
  readonly ground = input<DemoGround>('canvas');
  /** Optional caption above the frame. */
  readonly label = input<string>('');

  protected readonly groundClasses = computed(() => {
    switch (this.ground()) {
      case 'navy':
        return 'bg-brand-navy text-on-dark border-strong';
      case 'surface':
        return 'bg-surface text-primary border-default';
      case 'canvas':
        return 'bg-canvas text-primary border-default';
    }
  });
}
