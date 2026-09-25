import { computed, inject, signal, type Provider } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  EWMS_FAVORITE_LABELS,
  EWMS_SHORTCUT_MAP,
  type FavoriteLabelResolver,
} from '@ewms/design-system';
import { provideTranslocoScope, TranslocoService } from '@jsverse/transloco';
import { catalogKeyFor } from './catalog';
import { SHOWROOM_SHORTCUT_MAP } from './shortcuts.map';

/**
 * Lo propio del catálogo, en el layout: su scope de i18n, su mapa de atajos (registra `create`
 * sin el shell) y el nombre de sus páginas como favorito. Los textos del design system son los
 * del shell, traducidos: el catálogo muestra los componentes como los ve la aplicación.
 */
export function provideShowroomDesignSystem(): Provider[] {
  return [
    // Literal y no SHOWROOM_SCOPE: transloco-keys-manager encuentra el scope leyendo esta llamada.
    provideTranslocoScope('showroom'),
    { provide: EWMS_SHORTCUT_MAP, useValue: SHOWROOM_SHORTCUT_MAP },

    // Nombres de rutas, no el almacén: `EWMS_FAVORITES_STORE` y `Favorites` vienen de la aplicación.
    // Proveerlos otra vez dio una página con dos estrellas y dos listas en desacuerdo.
    // Las palabras se pueden proveer dos veces; el estado, no.
    { provide: EWMS_FAVORITE_LABELS, useFactory: favoriteLabels },
  ];
}

// Nombre de un favorito en la barra del catálogo: el de su entrada en `catalog.ts`, traducido; si
// no es del catálogo, se le pregunta al resolvedor de arriba (`skipSelf`). Sin nadie arriba no
// resuelve nada y el bloque muestra la ruta, como promete la librería.
function favoriteLabels(): FavoriteLabelResolver {
  const parent = inject(EWMS_FAVORITE_LABELS, { skipSelf: true, optional: true });
  const transloco = inject(TranslocoService);
  const lang = toSignal(transloco.langChanges$, { initialValue: transloco.getActiveLang() });
  return {
    labelFor: (route) => {
      const key = catalogKeyFor(route);
      if (key === null) {
        return parent?.labelFor(route) ?? signal('').asReadonly();
      }
      return computed(() => {
        lang();
        return transloco.translate(key);
      });
    },
    iconFor: (route) => (catalogKeyFor(route) === null ? (parent?.iconFor(route) ?? null) : null),
  };
}
