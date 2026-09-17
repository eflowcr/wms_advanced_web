import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { provideEwmsI18n } from '@ewms/core';
import { TRANSLOCO_LOADER, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { of, throwError, type Observable } from 'rxjs';

/**
 * The real i18n setup (transpiler, missing handler, locale, LanguageService)
 * with the dictionaries handed in instead of fetched over HTTP.
 *
 * Pass the real JSON files: a template key missing from them then throws in
 * the component spec, which is the point.
 *
 * Startup runs as an app initializer; await it before asserting:
 *
 *   await TestBed.inject(ApplicationInitStatus).donePromise;
 *
 * The initial language follows LanguageService's resolution, so stub
 * `navigator.language` when a spec depends on it. Startup never saves the
 * language; only `LanguageService.use()` does, so a spec that renders through
 * the browser language leaves no preference behind.
 */
export function provideI18nTesting(
  dictionaries: Readonly<Record<string, Translation>>,
): EnvironmentProviders {
  const loader: TranslocoLoader = {
    getTranslation(path: string): Observable<Translation> {
      const dictionary = dictionaries[path];
      // An error notification, not a throw: that is how a failed HTTP load
      // reaches Transloco, so leaving a language out of `dictionaries` is how
      // a spec simulates its dictionary failing to load.
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
