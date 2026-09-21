/**
 * Idiomas de la interfaz (ADR 0008). Uno nuevo empieza acá: tipo, lista y locales cambian
 * juntos, y el compilador marca cada `Record<Language, ...>` incompleto.
 */
export type Language = 'es' | 'en';

export const LANGUAGES: readonly Language[] = ['es', 'en'];

export const DEFAULT_LANGUAGE: Language = 'es';

/**
 * El idioma elige el diccionario; el locale, cómo se escriben fechas y números. La moneda no
 * sigue al idioma: es dato del registro, y un monto en colones sigue en colones en inglés.
 */
export const LANGUAGE_LOCALES: Readonly<Record<Language, string>> = {
  es: 'es-CR',
  en: 'en-US',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
