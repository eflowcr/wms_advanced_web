import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BRAND_NAME } from './brand';

/**
 * Título traducido por ruta (WCAG 2.4.2) desde `data.titleKey`: el `title` de Angular es un
 * texto fijo. «Artículos · eWMS Advance», pantalla primero porque la pestaña trunca por la
 * derecha. Se retitula al cambiar de idioma: es lo primero que anuncia un lector.
 */
@Injectable({ providedIn: 'root' })
export class EwmsTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);

  /** La última clave resuelta, para retitular al cambiar de idioma. */
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
   * La `titleKey` más profunda, porque la hija es más específica que el padre:
   * `/design-system/components/button` dice Botón, no «Sistema de diseño».
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
