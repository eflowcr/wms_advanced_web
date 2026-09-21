import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal, type Signal } from '@angular/core';
import { readPixels } from '../tokens/read-token';

/** El token que dice dónde cambia de forma la navegación. */
export const NAV_BOTTOM_BREAKPOINT_TOKEN = '--breakpoint-nav-bottom';

/**
 * DÓNDE CAMBIA DE FORMA EL LAYOUT, LEÍDO DEL TOKEN Y NO DE UN `md:`.
 *
 * Mapear el token al `@theme` de Tailwind emite una media query con `var()`
 * adentro, y una propiedad personalizada no se sustituye en una media feature: la
 * consulta es inválida y falsa a cualquier ancho. Compila, ninguna compuerta se
 * queja, y el layout no cambia nunca. Darle un literal mete un píxel crudo en
 * styles.css, que la compuerta 10 rechaza con razón.
 * Así que el token se lee con `readPixels` y se le pasa a `matchMedia`.
 * SIN TOKEN GANA EL LAYOUT ANCHO, y es decisión: el rail funciona a cualquier
 * ancho y solo cuesta espacio; la barra inferior sería la equivocada en escritorio.
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private readonly document = inject(DOCUMENT);

  private readonly wide = signal(true);

  /** Cierto cuando el viewport está en o sobre el punto de corte. */
  readonly isWide: Signal<boolean> = this.wide.asReadonly();

  constructor() {
    const view = this.document.defaultView;
    const breakpoint = readPixels(NAV_BOTTOM_BREAKPOINT_TOKEN);
    if (view === null || breakpoint === null) {
      return;
    }

    const query = view.matchMedia(`(min-width: ${breakpoint}px)`);
    this.wide.set(query.matches);

    const onChange = (event: MediaQueryListEvent): void => this.wide.set(event.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
  }
}
