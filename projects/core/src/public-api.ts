/*
 * Public API surface of @ewms/core
 *
 * This is the ONLY legal entry point into this library. Nothing outside it may
 * reach into src/lib/** directly -- see the boundary rules in eslint.config.js.
 */

// i18n (ADR 0008). Loader, transpiler, missing handler and fallback strategy stay internal.
export { provideEwmsI18n } from './lib/i18n/transloco.providers';
export { DictionaryUnavailableError, LanguageService } from './lib/i18n/language.service';
export { LANGUAGES, type Language } from './lib/i18n/language.types';
