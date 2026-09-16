import {
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import {
  provideTransloco,
  provideTranslocoFallbackStrategy,
  provideTranslocoMissingHandler,
  provideTranslocoTranspiler,
} from '@jsverse/transloco';
import { provideTranslocoLocale } from '@jsverse/transloco-locale';
import { IcuTranspiler } from './icu.transpiler';
import { LanguageService } from './language.service';
import { DEFAULT_LANGUAGE, LANGUAGE_LOCALES, LANGUAGES } from './language.types';
import { EwmsMissingHandler } from './missing-handler';
import { NoFallbackStrategy } from './no-fallback.strategy';
import { HttpTranslocoLoader } from './transloco.loader';

/**
 * Every i18n provider, in one place (ADR 0008). Requires HttpClient: the
 * application must also call provideHttpClient().
 *
 * The app does not render until the initial dictionary is loaded, so the
 * first paint is already in the right language. If no dictionary loads at
 * all, the initializer rejects with DictionaryUnavailableError and the app
 * does not start; the application decides what the user sees then.
 */
export function provideEwmsI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    ...provideTransloco({
      config: {
        availableLangs: [...LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        // No fallbackLang: a dictionary that fails to load is handled by
        // LanguageService, not by Transloco (see NoFallbackStrategy).
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: {
          // A key missing in en.json must not silently show the Spanish text:
          // it is a bug, and the missing handler reports it as one.
          useFallbackTranslation: false,
          allowEmpty: false,
        },
      },
      loader: HttpTranslocoLoader,
    }),
    // Registered after provideTransloco so they replace its defaults.
    provideTranslocoTranspiler(IcuTranspiler),
    provideTranslocoMissingHandler(EwmsMissingHandler),
    provideTranslocoFallbackStrategy(NoFallbackStrategy),
    // The language decides the locale. No currency mapping, on purpose: the
    // currency code is data of the record, never derived from the language.
    ...provideTranslocoLocale({ langToLocaleMapping: { ...LANGUAGE_LOCALES } }),
    provideAppInitializer(() => inject(LanguageService).init()),
  ]);
}
