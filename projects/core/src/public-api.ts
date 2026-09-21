// Única entrada legal a @ewms/core: nadie entra directo a src/lib/** (ver eslint.config.js).

// i18n (ADR 0008). Loader, transpiler, missing handler y estrategia de fallback quedan internos.
export { provideEwmsI18n } from './lib/i18n/transloco.providers';
export { DictionaryUnavailableError, LanguageService } from './lib/i18n/language.service';
export { LANGUAGES, type Language } from './lib/i18n/language.types';

// Sesión y almacén activo (DS-5): asiento del Security Core (SEC-MUL-002), no el Security Core.
export {
  SessionContext,
  type SessionCompany,
  type SessionUser,
  type SessionWarehouse,
} from './lib/session/session-context';
