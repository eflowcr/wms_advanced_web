import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BRAND_NAME } from './brand';
import { deepestTitleKey } from './route-title-key';

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
    this.lastKey = deepestTitleKey(snapshot.root) ?? null;
    this.apply(this.lastKey);
  }

  private apply(key: string | null): void {
    this.title.setTitle(
      key === null ? BRAND_NAME : `${this.transloco.translate(key)} · ${BRAND_NAME}`,
    );
  }
}
