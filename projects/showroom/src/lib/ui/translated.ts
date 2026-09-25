import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';

export type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Un valor armado con textos traducidos que sigue al idioma: opciones de un Select, campos de un
 * filtro, lo que un componente del sistema recibe ya escrito. Sus claves van declaradas en el
 * comentario marcador de siempre (i18n.md).
 */
export function translated<T>(build: (translate: Translate) => T): Signal<T> {
  const transloco = inject(TranslocoService);
  const lang = toSignal(transloco.langChanges$, { initialValue: transloco.getActiveLang() });
  return computed(() => {
    lang();
    return build((key, params) => transloco.translate(key, params));
  });
}
