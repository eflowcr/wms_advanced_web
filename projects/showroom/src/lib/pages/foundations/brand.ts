import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DemoFrame } from '../../ui/demo-frame';
import { TokenValue } from '../../ui/token-value';

/** One of the three shapes the eWMS mark comes in. */
interface BrandShape {
  readonly id: string;
  readonly name: string;
  readonly file: string;
  readonly mono: string;
  readonly alt: string;
  readonly use: string;
  /** Height utility, so the three keep a sensible relative scale. */
  readonly height: string;
}

const BRAND_BASE = '/brand';

/**
 * /design-system/foundations/brand — the mark, for the person building a screen.
 *
 * The question it answers is "I need the logo on this screen, which file and
 * how", and nothing else: no product messaging, no sales material (Showroom
 * spec, section 2, note of 2026-09-18).
 *
 * HOW THE MONO FILES ARE PAINTED, AND WHY NOT AS AN IMAGE ELEMENT
 *
 * The mono SVGs are a single path filled with `currentColor`. Loaded through
 * an `img` element they render in their own document, where `currentColor`
 * resolves to that document's initial colour and comes out black — the exact
 * opposite of what the file exists to prove. Inlining the markup is not available
 * either: gate 11 forbids a hand-written vector tag in a template (and reads
 * one in a comment exactly the same way, correctly), and the CSP forbids
 * injecting one.
 *
 * So the file is used as a MASK and the colour is a background of
 * `currentColor`. The mask's alpha is the glyph, so what lands on screen is
 * the same shape taking the same inherited colour, which is what the page is
 * demonstrating. It goes through the same `--color-text-*` tokens as any text.
 */
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

  /** The mask declaration for a mono file. See the class comment. */
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
