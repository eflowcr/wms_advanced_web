/*
 * Única entrada legal a @ewms/design-system; src/lib/** está cercado en eslint.config.js.
 *
 * Criterio, uno solo: se exporta lo que necesita quien consume la biblioteca —el shell, el
 * showroom, un dominio futuro o quien implemente una fuente del backend— y nada que solo exista
 * para que la biblioteca funcione por dentro. Un tipo de contrato o de entrada pública se queda
 * aunque hoy no lo importe nadie; un ayudante interno se va aunque sea útil.
 * Ver vault: 02-Arquitectura/Anatomia del Workspace §design-system.
 */

// `export *` por módulo y no la lista de nombres: esbuild no poda un barril con nombres y
// cualquier import arrastraba la biblioteca entera a `/`. Por nombre, solo los módulos con algo
// interno. Los nombres públicos los fija tools/ci/public-api.test.mjs.

export * from './lib/version';

// Iconografía (ADR 0011): la tabla la genera `npm run icons:build`.
export * from './lib/icon/icon';
export * from './lib/icon/icon.public';

export * from './lib/text/text';
export * from './lib/button/button';
export * from './lib/tooltip/tooltip';

// Campos (DS-2, Signal Forms desde 2026-09-22). `FieldSize` y `FieldState`
// se exportan una vez: Input y Select comparten escala y un segundo nombre derivaría.
export { type FieldSize, type FieldState } from './lib/field/field.types';
export * from './lib/input/input';
export * from './lib/checkbox/checkbox';
export * from './lib/radio/radio';
export * from './lib/radio/radio-group';
export * from './lib/toggle/toggle';

// Select (DS-2; siempre busca desde 2026-09-22, REQ-FE-DS3-001 v1.3): `options` filtra en
// memoria, `SearchSource<T>` es el contrato para el backend.
export * from './lib/select/select';
export * from './lib/select/select.public';

// Date picker (2026-09-21): calendario propio en el idioma de la app; valor ISO o `DateRange`.
export * from './lib/date-picker/date-picker';
export * from './lib/date-picker/date-picker.public';

// Feedback (DS-3): banner y toast comparten `FeedbackVariant`. Info se pinta neutral:
// el azul significa «acá se hace clic». Ver vault: Fundamentos de Marca.
export * from './lib/banner/banner';
export * from './lib/toast/toast.service';
export * from './lib/toast/toast-outlet';

// Badge (DS-3): fuera de la Tabla para que detalle, card y lista digan «con incidencia» igual.
export * from './lib/badge/badge';
export { type SemanticFamily } from './lib/feedback/feedback.types';

// Cards (DS-3): opción dentro de `ewms-card-group`, contenedor en cualquier otro lado.
export * from './lib/card/card';
export * from './lib/card/card-group';

// Dialog (DS-3), sobre el CDK. La confirmación no se exporta: se usa `confirm()`, así no
// hay dos caminos que terminen en dos confirmaciones distintas.
export * from './lib/dialog/dialog.service';
export { type ConfirmOptions, type DialogVariant } from './lib/dialog/dialog.types';

// Split button (2026-09-21): acción principal y alternativas, sobre el menú de la Tabla.
export * from './lib/split-button/split-button';
export * from './lib/split-button/split-button.public';

// Buscador en píldora (2026-09-25): el de la cabecera, estructura de YouTube con la pintura del sistema.
export * from './lib/search-box/search-box';
export * from './lib/search-box/search-box.public';

// Pagination (DS-3): aparte de la tabla, porque cards, logs y colas de picking también paginan.
export * from './lib/pagination/pagination';
export * from './lib/pagination/pagination.types';

// Estado vacío (2026-09-22): uno para tabla, select y pantalla, con cuatro casos.
export * from './lib/empty-state/empty-state';

// Patrón Formulario (2026-09-22): las reglas en un solo lugar, sobre Signal Forms (ADR 0013).
export * from './lib/forms/forms.public';
export * from './lib/forms/form-pattern';
export * from './lib/forms/confirm-discard';

// Patrón Filtros (2026-09-22): la barra de pantalla. Los chips los dibujan la barra y la Tabla,
// así que la pieza no se exporta; su diccionario sí, porque lo llena la aplicación.
export * from './lib/filters/filter-chips.types';
export * from './lib/filters/filter-bar';
export * from './lib/filters/filter-bar.types';

// Tabla (DS-3), la pieza y sus plantillas: `*ewmsCell`, `*ewmsDetail` y `*ewmsEmpty` las escribe
// el consumidor, así que las tres directivas se importan desde afuera.
export * from './lib/table/table';

// Tabla, el contrato de datos: `TableSource<T>` es lo que implementa el backend, y los tres
// guardas discriminan el `TableFilterValue` que le llega en la consulta.
export * from './lib/table/table.public';

// Tabla, sus textos y formatos (ADR 0008), y los tipos de sus entradas y salidas.
export * from './lib/table/table.tokens';
export {
  type BadgeDescriptor,
  type BadgeDictionary,
  type MenuItem,
  type RowActivateEvent,
  type RowMenuEvent,
  type RowState,
  type TableChildren,
  type TableColumnType,
  type TableColumnWidth,
  type TableDensity,
  type BulkActionEvent,
  type ExportRequest,
  type TableAggregate,
  type TablePin,
  type TableView,
} from './lib/table/table.types';
// Las claves de `TableMessages.columnActions`, que llena el consumidor.
export { type ColumnAction } from './lib/table/table-column-menu';

// Atajos (DS-4, REQ-FE-DS4-001): el motor vive acá y no en `core/`. Ver vault: Atajos-de-Teclado.
// `ScanDetector` se exporta para que nadie escriba una segunda respuesta a «¿es una pistola?».
export * from './lib/keyboard/keyboard-shortcuts';
export * from './lib/keyboard/shortcuts-host';
// `SCAN_THRESHOLD_TOKEN` nombra el token CSS del umbral: el valor vive en `tokens.css`, y quien
// tenga que ponerlo desde afuera —hoy la spec del showroom, que corre sin la hoja— no lo tipea.
export * from './lib/keyboard/scan-detector';
export * from './lib/keyboard/keyboard.public';

// Navegación (DS-5): ninguna pieza conoce el router; navega el shell. `Viewport` se exporta para
// que shell y navegación den una sola respuesta al punto de corte (si no, barra y rail a la vez).
export * from './lib/navigation/nav-rail';
export * from './lib/navigation/navigation.public';
export * from './lib/navigation/tabs';
export * from './lib/navigation/breadcrumbs';

/*
 * Favoritos (DS-5, REQ-FE-DS4-002 v1.2): `InMemoryFavoritesStore` se exporta porque lo usan
 * shell y showroom. Se pierde al recargar (decisión del usuario, 2026-09-19, hasta el
 * Security Core); un E2E afirma la pérdida para que el backend obligue a actualizar la doc.
 * `EWMS_FAVORITE_LABELS` (v1.3): el nombre de una ruta se pregunta al pintar, nunca se guarda.
 */
export * from './lib/favorites/favorites';
export * from './lib/favorites/favorite-toggle';
export * from './lib/favorites/favorites.public';
export * from './lib/favorites/in-memory-favorites-store';
export * from './lib/favorites/favorites.types';
