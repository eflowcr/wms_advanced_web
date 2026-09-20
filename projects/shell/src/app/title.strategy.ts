import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BRAND_NAME } from './brand';

/**
 * EVERY ROUTE HAS A TITLE, AND IT IS TRANSLATED (WCAG 2.4.2).
 *
 * Angular's own `title` on a route takes a STRING, which is exactly the wrong
 * shape here: a string is frozen in whatever language it was written in, and
 * switching language would leave the browser tab in the other one. So the
 * routes carry `data.titleKey` and this strategy resolves it against the
 * active dictionary.
 *
 * «Artículos · eWMS Advance», in that order, because a tab strip truncates
 * from the right and the part that tells two tabs apart is the screen's name,
 * not the product's.
 *
 * IT ALSO RE-TITLES ON A LANGUAGE CHANGE. Without that, switching language
 * redraws the whole interface and leaves the one string the browser owns
 * behind -- and it is the string a screen reader announces first.
 */
@Injectable({ providedIn: 'root' })
export class EwmsTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);

  /** The last route resolved, so a language change can re-title it. */
  private lastKey: string | null = null;

  constructor() {
    super();
    this.transloco.langChanges$.subscribe(() => this.apply(this.lastKey));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.lastKey = this.titleKeyOf(snapshot) ?? null;
    this.apply(this.lastKey);
  }

  private apply(key: string | null): void {
    this.title.setTitle(
      key === null ? BRAND_NAME : `${this.transloco.translate(key)} · ${BRAND_NAME}`,
    );
  }

  /**
   * The deepest `titleKey` in the activated tree.
   *
   * Deepest and not nearest-declared, because a child route is more specific
   * than its parent: `/design-system/components/button` should say Botón, not
   * «Sistema de diseño».
   */
  private titleKeyOf(snapshot: RouterStateSnapshot): string | undefined {
    let route = snapshot.root;
    let key: string | undefined;
    while (route.firstChild !== null) {
      route = route.firstChild;
      const candidate = route.data['titleKey'] as string | undefined;
      if (candidate !== undefined) {
        key = candidate;
      }
    }
    return key;
  }
}
