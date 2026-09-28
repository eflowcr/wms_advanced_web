/**
 * La versión de la aplicación, la del package.json de la raíz: la marca de agua la muestra para que
 * soporte sepa qué tiene el usuario. Literal y no import del JSON, que metería el manifiesto entero
 * en el bundle; `tools/ci/library-version.test.mjs` las mantiene iguales.
 */
export const APP_VERSION = '0.0.0';
