import en from '../../public/i18n/en.json';
import es from '../../public/i18n/es.json';

/**
 * Los diccionarios reales, solo para specs: una clave faltante lanza en la prueba. Como
 * `*.spec.ts`, queda fuera del build (tsconfig.app.json) y del typecheck.
 */
export const DICTIONARIES = { es, en } as const;
