/**
 * The languages the interface speaks (ADR 0008). Adding one starts here: the
 * type, the list and the locale map below must change together, and the
 * compiler flags every `Record<Language, ...>` that is left incomplete.
 */
export type Language = 'es' | 'en';

export const LANGUAGES: readonly Language[] = ['es', 'en'];

export const DEFAULT_LANGUAGE: Language = 'es';

/**
 * The language picks the dictionary; the locale picks how dates, numbers and
 * separators are written. They travel together but are not the same thing.
 *
 * The currency is NOT here and never follows the language: an amount in
 * colones is still colones with the interface in English. The currency code
 * is data of the record being shown, not an interface preference.
 */
export const LANGUAGE_LOCALES: Readonly<Record<Language, string>> = {
  es: 'es-CR',
  en: 'en-US',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
