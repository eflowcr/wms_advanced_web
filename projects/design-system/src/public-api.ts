/*
 * Única entrada legal a @ewms/design-system; src/lib/** está cercado en eslint.config.js.
 *
 * Criterio, uno solo: se exporta lo que necesita quien consume la biblioteca —el shell, el
 * showroom, un dominio futuro o quien implemente una fuente del backend— y nada que solo exista
 * para que la biblioteca funcione por dentro. Un tipo de contrato o de entrada pública se queda
 * aunque hoy no lo importe nadie; un ayudante interno se va aunque sea útil.
 * Ver vault: 02-Arquitectura/Anatomia del Workspace §design-system.
 */

export { DESIGN_SYSTEM_VERSION } from './lib/version';

// Iconografía (ADR 0011): la tabla la genera `npm run icons:build`.
export { Icon, type IconSize } from './lib/icon/icon';
export { ICON_CATEGORIES, type IconCategory, type IconName } from './icons/icons.generated';

export { Text, type TextVariant } from './lib/text/text';
export {
  Button,
  type ButtonIconPosition,
  type ButtonSize,
  type ButtonVariant,
} from './lib/button/button';
export { Tooltip, type TooltipPosition } from './lib/tooltip/tooltip';

// Campos (DS-2, Signal Forms desde 2026-09-22). `FieldSize` y `FieldState`
// se exportan una vez: Input y Select comparten escala y un segundo nombre derivaría.
export { type FieldSize, type FieldState } from './lib/field/field.types';
export { Input, type InputType } from './lib/input/input';
export { Checkbox } from './lib/checkbox/checkbox';
export { Radio } from './lib/radio/radio';
export { RadioGroup } from './lib/radio/radio-group';
export { Toggle } from './lib/toggle/toggle';

// Select (DS-2; siempre busca desde 2026-09-22, REQ-FE-DS3-001 v1.3): `options` filtra en
// memoria, `SearchSource<T>` es el contrato para el backend.
export {
  Select,
  type SearchDisplay,
  type SearchPage,
  type SearchSource,
  type SelectMessages,
  type SelectOption,
} from './lib/select/select';
export { EWMS_SELECT_MESSAGES } from './lib/select/select.types';
export { SEARCH_PAGE_SIZE } from './lib/select/search-source';

// Date picker (2026-09-21): calendario propio en el idioma de la app; valor ISO o `DateRange`.
export {
  DatePicker,
  type DatePickerMessages,
  type DatePickerMode,
  type DatePickerValue,
} from './lib/date-picker/date-picker';
export { EWMS_DATE_PICKER_MESSAGES } from './lib/date-picker/date-picker.types';

// Feedback (DS-3): banner y toast comparten `FeedbackVariant`. Info se pinta neutral:
// el azul significa «acá se hace clic». Ver vault: Fundamentos de Marca.
export { Banner, type FeedbackVariant } from './lib/banner/banner';
export { ToastService } from './lib/toast/toast.service';
export { ToastOutlet, type Toast } from './lib/toast/toast-outlet';

// Badge (DS-3): fuera de la Tabla para que detalle, card y lista digan «con incidencia» igual.
export { Badge } from './lib/badge/badge';
export { type SemanticFamily } from './lib/feedback/feedback.types';

// Cards (DS-3): opción dentro de `ewms-card-group`, contenedor en cualquier otro lado.
export { Card } from './lib/card/card';
export { CardGroup } from './lib/card/card-group';

// Dialog (DS-3), sobre el CDK. La confirmación no se exporta: se usa `confirm()`, así no
// hay dos caminos que terminen en dos confirmaciones distintas.
export { DialogService, type OpenDialogOptions } from './lib/dialog/dialog.service';
export { type ConfirmOptions, type DialogTone } from './lib/dialog/dialog.types';

// Split button (2026-09-21): acción principal y alternativas, sobre el menú de la Tabla.
export {
  SplitButton,
  type SplitAction,
  type SplitButtonMessages,
} from './lib/split-button/split-button';
export { EWMS_SPLIT_BUTTON_MESSAGES } from './lib/split-button/split-button.types';

// Buscador en píldora (2026-09-25): el de la cabecera, estructura de YouTube con la pintura del sistema.
export { SearchBox, type SearchBoxMessages } from './lib/search-box/search-box';
export { EWMS_SEARCH_BOX_MESSAGES } from './lib/search-box/search-box.types';

// Pagination (DS-3): aparte de la tabla, porque cards, logs y colas de picking también paginan.
export {
  EWMS_PAGINATION_MESSAGES,
  Pagination,
  type PaginationMessages,
} from './lib/pagination/pagination';

// Estado vacío (2026-09-22): uno para tabla, select y pantalla, con cuatro casos.
export {
  EmptyState,
  type EmptyStateAction,
  type EmptyStateKind,
  type EmptyStateSize,
} from './lib/empty-state/empty-state';

// Patrón Formulario (2026-09-22): las reglas en un solo lugar, sobre Signal Forms (ADR 0013).
export {
  EWMS_FORM_MESSAGES,
  type FormErrorKind,
  type FormErrorWriter,
  type FormErrorWriters,
  type FormMessages,
} from './lib/forms/form.types';
export { FormPattern, type FormAction } from './lib/forms/form-pattern';
export { confirmDiscard } from './lib/forms/confirm-discard';

// Patrón Filtros (2026-09-22): la barra de pantalla. Los chips los dibujan la barra y la Tabla,
// así que la pieza no se exporta; su diccionario sí, porque lo llena la aplicación.
export {
  EWMS_FILTER_CHIPS_MESSAGES,
  type FilterChipsMessages,
} from './lib/filters/filter-chips';
export {
  EWMS_FILTER_BAR_MESSAGES,
  FilterBar,
  type FilterBarMessages,
  type FilterField,
  type FilterFieldValue,
  type FilterValues,
} from './lib/filters/filter-bar';

// Tabla (DS-3), la pieza y sus plantillas: `*ewmsCell`, `*ewmsDetail` y `*ewmsEmpty` las escribe
// el consumidor, así que las tres directivas se importan desde afuera.
export {
  Table,
  CellTemplate,
  DetailTemplate,
  EmptyTemplate,
  TableColumn,
  type CellContext,
} from './lib/table/table';

// Tabla, el contrato de datos: `TableSource<T>` es lo que implementa el backend, y los tres
// guardas discriminan el `TableFilterValue` que le llega en la consulta.
export { ArrayTableSource } from './lib/table/array-table-source';
export {
  isDateRange,
  isNumberRange,
  isSetFilter,
  type DateRange,
  type NumberRange,
  type SetFilter,
  type TableFilterValue,
  type TablePage,
  type TableQuery,
  type TableSort,
  type TableSource,
} from './lib/table/table-source';

// Tabla, sus textos y formatos (ADR 0008), y los tipos de sus entradas y salidas.
export {
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  parseTableDate,
  type TableFormatters,
  type TableMessages,
} from './lib/table/table.tokens';
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
export {
  KeyboardShortcuts,
  type ShortcutEvent,
  type ShortcutOutcome,
  type Unregister,
} from './lib/keyboard/keyboard-shortcuts';
export { ShortcutsHost } from './lib/keyboard/shortcuts-host';
// `SCAN_THRESHOLD_TOKEN` nombra el token CSS del umbral: el valor vive en `tokens.css`, y quien
// tenga que ponerlo desde afuera —hoy la spec del showroom, que corre sin la hoja— no lo tipea.
export {
  ScanDetector,
  SCAN_MIN_KEYSTROKES,
  SCAN_THRESHOLD_TOKEN,
  type ScanVerdict,
} from './lib/keyboard/scan-detector';
export {
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SHORTCUT_MAP,
  isSingleCharacter,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutHelpMessages,
  type ShortcutMap,
} from './lib/keyboard/shortcuts.types';

// Navegación (DS-5): ninguna pieza conoce el router; navega el shell. `Viewport` se exporta para
// que shell y navegación den una sola respuesta al punto de corte (si no, barra y rail a la vez).
export { NavRail } from './lib/navigation/nav-rail';
export { NavBottom } from './lib/navigation/nav-bottom';
export { Tabs, type TabsMode } from './lib/navigation/tabs';
export { Breadcrumbs } from './lib/navigation/breadcrumbs';
export { Viewport } from './lib/navigation/viewport';
export { parentOf, type Crumb, type NavItem, type Tab } from './lib/navigation/navigation.types';

/*
 * Favoritos (DS-5, REQ-FE-DS4-002 v1.2): `InMemoryFavoritesStore` se exporta porque lo usan
 * shell y showroom. Se pierde al recargar (decisión del usuario, 2026-09-19, hasta el
 * Security Core); un E2E afirma la pérdida para que el backend obligue a actualizar la doc.
 * `EWMS_FAVORITE_LABELS` (v1.3): el nombre de una ruta se pregunta al pintar, nunca se guarda.
 */
export { Favorites } from './lib/favorites/favorites';
export { FavoriteToggle } from './lib/favorites/favorite-toggle';
export { FavoritesNav } from './lib/favorites/favorites-nav';
export { InMemoryFavoritesStore } from './lib/favorites/in-memory-favorites-store';
export {
  EWMS_FAVORITE_LABELS,
  EWMS_FAVORITES_STORE,
  type Favorite,
  type FavoriteLabelResolver,
  type FavoritesStore,
} from './lib/favorites/favorites.types';
