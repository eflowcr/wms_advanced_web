import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { readPixels } from '../tokens/read-token';

export const NAV_BOTTOM_BREAKPOINT_TOKEN = '--breakpoint-nav-bottom';
export const NAV_DRAWER_BREAKPOINT_TOKEN = '--breakpoint-nav-drawer';

/**
 * Puntos de corte leídos del token con `readPixels` + `matchMedia`: con `var()` en el `@theme`
 * la media query es inválida. Sin token gana el ancho. Ver vault: Navegacion (móvil).
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly wide = signal(true);
  private readonly roomy = signal(true);

  /** En o sobre el punto de corte. */
  readonly isWide: Signal<boolean> = this.wide.asReadonly();

  /** Desde el corte del cajón el panel abierto cabe junto al contenido y lo empuja; debajo, cajón. */
  readonly panelFits: Signal<boolean> = this.roomy.asReadonly();

  constructor() {
    this.follow(NAV_BOTTOM_BREAKPOINT_TOKEN, this.wide);
    this.follow(NAV_DRAWER_BREAKPOINT_TOKEN, this.roomy);
  }

  private follow(token: string, target: WritableSignal<boolean>): void {
    const view = this.document.defaultView;
    const breakpoint = readPixels(token);
    if (view === null || breakpoint === null) {
      return;
    }

    const query = view.matchMedia(`(min-width: ${breakpoint}px)`);
    target.set(query.matches);

    const onChange = (event: MediaQueryListEvent): void => target.set(event.matches);
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }
}
