import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal, type Signal } from '@angular/core';
import { readPixels } from '../tokens/read-token';

/** The token that says where the navigation changes shape. */
export const NAV_BOTTOM_BREAKPOINT_TOKEN = '--breakpoint-nav-bottom';

/**
 * WHERE THE LAYOUT CHANGES SHAPE, READ FROM THE TOKEN AND NOT FROM A `md:`.
 *
 * The point of change is a design decision, so it lives in tokens.css like the
 * height of the header. Getting it from there to a media query is the part
 * that is not obvious, and the obvious route is broken:
 *
 *   Mapping `--breakpoint-nav-bottom` into Tailwind's `@theme` emits
 *   `@media (width >= var(--breakpoint-nav-bottom))`. A custom property is not
 *   substituted inside a media feature, so that query is invalid and false at
 *   every width. It compiles, no gate objects, and the layout never changes.
 *   Handing Tailwind a literal instead puts a raw pixel value in styles.css,
 *   which gate 10 rejects -- correctly.
 *
 * So the token is read with `readPixels` and handed to `matchMedia`. It is the
 * same move `ToastService` makes with `--duration-toast` and the shortcut
 * engine with `--threshold-scan-keystroke`, for the same reason: the value
 * cannot travel as a declaration, and a copy in the code is the drift gate 10
 * exists to prevent.
 *
 * WHEN THE TOKEN IS NOT THERE, THE WIDE LAYOUT WINS, and that is a decision
 * rather than a default. `readPixels` returns null when the stylesheet has not
 * loaded; with no number there is no query to ask, and the rail is the layout
 * that works at every width -- it merely costs space on a narrow screen. The
 * bottom bar is the one that would be wrong on a desktop.
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private readonly document = inject(DOCUMENT);

  private readonly wide = signal(true);

  /** True when the viewport is at or above the navigation breakpoint. */
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
