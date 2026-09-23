/**
 * Versión de la biblioteca; el showroom la muestra. Literal y no `import` del `package.json`:
 * la ruta escapa de `src/` y `ng-packagr` no la resuelve, con lo que `build:libs` quedaba en rojo.
 * Espeja `projects/design-system/package.json`; se cambian las dos a la vez.
 */
export const DESIGN_SYSTEM_VERSION = '0.0.1';
