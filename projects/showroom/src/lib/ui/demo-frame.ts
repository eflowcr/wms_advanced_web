import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Fondo sobre el que va una demo; `none`, sin marco, para lo que trae el suyo (la Tabla). */
export type DemoGround = 'canvas' | 'surface' | 'navy' | 'none';

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

  /** Un solo marco alrededor de una tabla: dos anidados pesan más que los datos. */
  protected readonly frameClasses = computed(() => {
    switch (this.ground()) {
      case 'none':
        return '';
      case 'navy':
        return 'rounded-md border p-6 bg-brand-navy text-on-dark border-strong';
      case 'surface':
        return 'rounded-md border p-6 bg-surface text-primary border-default';
      case 'canvas':
        return 'rounded-md border p-6 bg-canvas text-primary border-default';
    }
  });
}
