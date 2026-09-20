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

/*
 * Session and active warehouse (DS-5).
 *
 * The SEAT of the Security Core (SEC-MUL-002), not the thing itself: the shape
 * of the state PLN-WMS-002 §5 asks for from phase 0, with synthetic values in
 * memory, so the App Shell draws credentials from DATA rather than from text
 * in a template. When the backend's Security Core exists (PLN-WMS-005,
 * Sprint 1) this is filled from it and no layout changes.
 */
export {
  SessionContext,
  type SessionCompany,
  type SessionUser,
  type SessionWarehouse,
} from './lib/session/session-context';
