import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, type IconName } from '../../icons/icons.generated';

export type IconSize = 'sm' | 'md' | 'lg' | 'xl';

/** Ancho/alto y grosor de trazo viajan juntos: el trazo se compensa por tamaño en
 * tokens.css (--size-icon-* / --stroke-icon-*). */
const SIZE_CLASSES: Readonly<Record<IconSize, string>> = {
  sm: 'size-icon-sm stroke-icon-sm',
  md: 'size-icon-md stroke-icon-md',
  lg: 'size-icon-lg stroke-icon-lg',
  xl: 'size-icon-xl stroke-icon-xl',
};

/**
 * La única forma de poner un icono en pantalla (ADR 0011).
 *
 * La geometría es dato: la plantilla recorre las primitivas y ata cada atributo.
 * Sin innerHTML y sin DomSanitizer, así que un icono no puede llevar marcado.
 * El color siempre es `currentColor`: hereda del contenedor y nunca pone uno.
 * La accesibilidad la decide si el icono lleva información: sin `label` es
 * decorativo -aria-hidden y fuera del foco-, con `label` es `role="img"` con ese
 * nombre, que viene del consumidor y por eso se traduce donde se usa.
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
