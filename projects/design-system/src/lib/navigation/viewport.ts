import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal, type Signal } from '@angular/core';
import { readPixels } from '../tokens/read-token';

export const NAV_BOTTOM_BREAKPOINT_TOKEN = '--breakpoint-nav-bottom';

/**
 * Punto de corte leído del token con `readPixels` + `matchMedia`: con `var()` en el `@theme`
 * la media query es inválida. Sin token gana el ancho. Ver vault: Navegacion (móvil).
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private readonly document = inject(DOCUMENT);

  private readonly wide = signal(true);

  /** En o sobre el punto de corte. */
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
