import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Fondo sobre el que va una demo. */
export type DemoGround = 'canvas' | 'surface' | 'navy';

/**
 * Widget 5.4, marco de demo. Tres fondos porque algunos tokens solo se juzgan en el suyo
 * (`--color-text-on-dark` no dice nada sobre blanco). Hecho con tokens, sin componentes del DS.
 */
@Component({
  selector: 'ewms-demo-frame',
  templateUrl: './demo-frame.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoFrame {
  readonly ground = input<DemoGround>('canvas');
  /** Leyenda opcional sobre el marco. */
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
