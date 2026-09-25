import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { Prose } from '../../ui/prose';
import { TokenValue } from '../../ui/token-value';

/** Una de las tres formas de la marca eWMS. `name`, `alt` y `use` son claves del diccionario. */
interface BrandShape {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly mono: string;
  readonly alt: string;
  readonly use: string;
  /** Utilidad de alto, para que las tres guarden una escala relativa sensata. */
  readonly height: string;
}

const BRAND_BASE = '/brand';

/**
 * La marca, para quien arma una pantalla: qué archivo y cómo, nada de material comercial
 * (Ver vault: Showroom - Especificacion §2, nota del 2026-09-18).
 */
// Los SVG mono van como máscara con fondo `currentColor`: en un `img` se pintan negros (otro
// documento), y la compuerta 11 y la CSP impiden incrustarlos. Así heredan el color del texto.
@Component({
  selector: 'ewms-showroom-brand',
  imports: [DemoFrame, Prose, TokenValue, TranslocoPipe],
  templateUrl: './brand.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomBrand {
  protected readonly lockup = `${BRAND_BASE}/ewms-lockup.svg`;
  protected readonly isotipoMono = `${BRAND_BASE}/ewms-isotipo-mono.svg`;
  protected readonly lockupMono = `${BRAND_BASE}/ewms-lockup-mono.svg`;

  /**
   * t(showroom.brand.shapes.logomark.name, showroom.brand.shapes.logomark.alt,
   *   showroom.brand.shapes.logomark.use, showroom.brand.shapes.wordmark.name,
   *   showroom.brand.shapes.wordmark.alt, showroom.brand.shapes.wordmark.use,
   *   showroom.brand.shapes.lockup.name, showroom.brand.shapes.lockup.alt,
   *   showroom.brand.shapes.lockup.use)
   */
  protected readonly shapes: readonly BrandShape[] = [
    {
      id: 'isotipo',
      name: 'showroom.brand.shapes.logomark.name',
      file: `${BRAND_BASE}/ewms-isotipo.svg`,
      mono: `${BRAND_BASE}/ewms-isotipo-mono.svg`,
      alt: 'showroom.brand.shapes.logomark.alt',
      use: 'showroom.brand.shapes.logomark.use',
      height: 'h-16',
    },
    {
      id: 'wordmark',
      name: 'showroom.brand.shapes.wordmark.name',
      file: `${BRAND_BASE}/ewms-wordmark.svg`,
      mono: `${BRAND_BASE}/ewms-wordmark-mono.svg`,
      alt: 'showroom.brand.shapes.wordmark.alt',
      use: 'showroom.brand.shapes.wordmark.use',
      height: 'h-8',
    },
    {
      id: 'lockup',
      name: 'showroom.brand.shapes.lockup.name',
      file: `${BRAND_BASE}/ewms-lockup.svg`,
      mono: `${BRAND_BASE}/ewms-lockup-mono.svg`,
      alt: 'showroom.brand.shapes.lockup.alt',
      use: 'showroom.brand.shapes.lockup.use',
      height: 'h-12',
    },
  ];

  /**
   * t(showroom.brand.eprac.fullColour.name, showroom.brand.eprac.fullColour.alt,
   *   showroom.brand.eprac.fullColour.use, showroom.brand.eprac.navy.name,
   *   showroom.brand.eprac.navy.alt, showroom.brand.eprac.navy.use,
   *   showroom.brand.eprac.white.name, showroom.brand.eprac.white.alt,
   *   showroom.brand.eprac.white.use)
   */
  protected readonly eprac = [
    {
      id: 'fullcolor',
      name: 'showroom.brand.eprac.fullColour.name',
      file: `${BRAND_BASE}/eprac/eprac-fullcolor.png`,
      alt: 'showroom.brand.eprac.fullColour.alt',
      ground: 'surface' as const,
      use: 'showroom.brand.eprac.fullColour.use',
    },
    {
      id: 'navy',
      name: 'showroom.brand.eprac.navy.name',
      file: `${BRAND_BASE}/eprac/eprac-navy.png`,
      alt: 'showroom.brand.eprac.navy.alt',
      ground: 'surface' as const,
      use: 'showroom.brand.eprac.navy.use',
    },
    {
      id: 'blanco',
      name: 'showroom.brand.eprac.white.name',
      file: `${BRAND_BASE}/eprac/eprac-blanco.png`,
      alt: 'showroom.brand.eprac.white.alt',
      ground: 'navy' as const,
      use: 'showroom.brand.eprac.white.use',
    },
  ];

  /** Declaración de máscara para un archivo mono (ver el comentario de la clase). */
  protected mono(file: string): Record<string, string> {
    return {
      'mask-image': `url("${file}")`,
      'mask-repeat': 'no-repeat',
      'mask-position': 'center',
      'mask-size': 'contain',
      'background-color': 'currentColor',
    };
  }
}
