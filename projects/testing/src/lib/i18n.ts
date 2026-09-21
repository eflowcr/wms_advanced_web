import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { provideEwmsI18n } from '@ewms/core';
import { TRANSLOCO_LOADER, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { of, throwError, type Observable } from 'rxjs';

/**
 * La configuracion i18n real, con los diccionarios pasados en memoria en vez de
 * HTTP. Pasar los JSON reales para que una clave faltante falle en el spec.
 * Esperar `ApplicationInitStatus.donePromise` antes de afirmar.
 */
export function provideI18nTesting(
  dictionaries: Readonly<Record<string, Translation>>,
): EnvironmentProviders {
  const loader: TranslocoLoader = {
    getTranslation(path: string): Observable<Translation> {
      const dictionary = dictionaries[path];
      // Idioma ausente: se emite error, igual que una carga HTTP fallida.
      return dictionary
        ? of(dictionary)
        : throwError(() => new Error(`provideI18nTesting: no dictionary for '${path}'.`));
    },
  };
  return makeEnvironmentProviders([
    provideEwmsI18n(),
    { provide: TRANSLOCO_LOADER, useValue: loader },
  ]);
}
