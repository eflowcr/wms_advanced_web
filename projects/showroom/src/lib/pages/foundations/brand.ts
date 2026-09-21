import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DemoFrame } from '../../ui/demo-frame';
import { TokenValue } from '../../ui/token-value';

/** Una de las tres formas de la marca eWMS. */
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
  imports: [DemoFrame, TokenValue],
  templateUrl: './brand.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomBrand {
  protected readonly lockup = `${BRAND_BASE}/ewms-lockup.svg`;
  protected readonly isotipoMono = `${BRAND_BASE}/ewms-isotipo-mono.svg`;
  protected readonly lockupMono = `${BRAND_BASE}/ewms-lockup-mono.svg`;

  protected readonly shapes: readonly BrandShape[] = [
    {
      id: 'isotipo',
      name: 'Isotipo',
      file: `${BRAND_BASE}/ewms-isotipo.svg`,
      mono: `${BRAND_BASE}/ewms-isotipo-mono.svg`,
      alt: 'Isotipo de eWMS: la "e" circular',
      use: 'Cuando el espacio es cuadrado y la marca ya se estableció en la pantalla: favicon, avatar, rail colapsado.',
      height: 'h-16',
    },
    {
      id: 'wordmark',
      name: 'Wordmark',
      file: `${BRAND_BASE}/ewms-wordmark.svg`,
      mono: `${BRAND_BASE}/ewms-wordmark-mono.svg`,
      alt: 'Wordmark de eWMS',
      use: 'Cuando hace falta el nombre pero no el tagline, y el alto disponible es poco.',
      height: 'h-8',
    },
    {
      id: 'lockup',
      name: 'Lockup',
      file: `${BRAND_BASE}/ewms-lockup.svg`,
      mono: `${BRAND_BASE}/ewms-lockup-mono.svg`,
      alt: 'Lockup de eWMS: nombre y tagline "Warehouse Management System"',
      use: 'En la primera aparición de la marca: pantalla de acceso, encabezado de un documento, portada de un reporte.',
      height: 'h-12',
    },
  ];

  protected readonly eprac = [
    {
      id: 'fullcolor',
      name: 'Fullcolor',
      file: `${BRAND_BASE}/eprac/eprac-fullcolor.png`,
      alt: 'Logo de ePRAC a color',
      ground: 'surface' as const,
      use: 'Sobre superficie clara, cuando la marca de la empresa va a color.',
    },
    {
      id: 'navy',
      name: 'Navy',
      file: `${BRAND_BASE}/eprac/eprac-navy.png`,
      alt: 'Logo de ePRAC en navy',
      ground: 'surface' as const,
      use: 'Sobre superficie clara, a una sola tinta.',
    },
    {
      id: 'blanco',
      name: 'Blanco',
      file: `${BRAND_BASE}/eprac/eprac-blanco.png`,
      alt: 'Logo de ePRAC en blanco',
      ground: 'navy' as const,
      use: 'Sobre el rail navy y sobre cualquier superficie oscura.',
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
