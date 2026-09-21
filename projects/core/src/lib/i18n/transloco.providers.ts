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
 * Todos los providers de i18n (ADR 0008); requiere provideHttpClient(). No se pinta sin el
 * diccionario inicial; si ninguno carga, rechaza con DictionaryUnavailableError.
 */
export function provideEwmsI18n(): EnvironmentProviders {
  return makeEnvironmentProviders([
    ...provideTransloco({
      config: {
        availableLangs: [...LANGUAGES],
        defaultLang: DEFAULT_LANGUAGE,
        // Sin fallbackLang: el diccionario que no carga lo maneja LanguageService.
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: {
          // Una clave que falta en en.json no cae al español en silencio: es un bug.
          useFallbackTranslation: false,
          allowEmpty: false,
        },
      },
      loader: HttpTranslocoLoader,
    }),
    // Después de provideTransloco, para reemplazar sus valores por defecto.
    provideTranslocoTranspiler(IcuTranspiler),
    provideTranslocoMissingHandler(EwmsMissingHandler),
    provideTranslocoFallbackStrategy(NoFallbackStrategy),
    // Sin mapeo de moneda a propósito: el código de moneda es dato del registro.
    ...provideTranslocoLocale({ langToLocaleMapping: { ...LANGUAGE_LOCALES } }),
    provideAppInitializer(() => inject(LanguageService).init()),
  ]);
}
