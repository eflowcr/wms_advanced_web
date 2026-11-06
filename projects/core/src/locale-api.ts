import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { provideTranslocoLocale, TranslocoLocaleService } from '@jsverse/transloco-locale';
import { LANGUAGE_LOCALES } from './lib/i18n/language.types';

/** Formateadores cargados con las pantallas que los utilizan. */
export function provideEwmsLocale(): EnvironmentProviders {
  return makeEnvironmentProviders([
    TranslocoLocaleService,
    ...provideTranslocoLocale({ langToLocaleMapping: { ...LANGUAGE_LOCALES } }),
  ]);
}
