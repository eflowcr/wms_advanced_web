import en from '../../public/i18n/en.json';
import es from '../../public/i18n/es.json';
import showroomEn from '../../public/i18n/showroom/en.json';
import showroomEs from '../../public/i18n/showroom/es.json';

/**
 * Los diccionarios reales, solo para specs: una clave faltante lanza en la prueba. Como
 * `*.spec.ts`, queda fuera del build (tsconfig.app.json) y del typecheck.
 */
export const DICTIONARIES = { es, en } as const;

/** Los mismos, más el scope del catálogo, que el loader pide como `showroom/<lang>`. */
export const WITH_SHOWROOM = {
  ...DICTIONARIES,
  'showroom/es': showroomEs,
  'showroom/en': showroomEn,
} as const;
