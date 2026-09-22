// Única entrada legal a @ewms/design-system; src/lib/** está cercado en eslint.config.js.
export { DESIGN_SYSTEM_VERSION } from './lib/version';
export { Icon, type IconSize } from './lib/icon/icon';
export { Text, type TextVariant } from './lib/text/text';
export {
  Button,
  type ButtonIconPosition,
  type ButtonSize,
  type ButtonVariant,
} from './lib/button/button';
export { Tooltip, type TooltipPosition } from './lib/tooltip/tooltip';

// Formulario (DS-2), ControlValueAccessor por una base común. `FieldSize` y `FieldState`
// se exportan una vez: Input y Select comparten escala y un segundo nombre derivaría.
export { type FieldSize, type FieldState } from './lib/field/field.types';
export { Input, type InputType } from './lib/input/input';
export { Checkbox } from './lib/checkbox/checkbox';
export { Radio } from './lib/radio/radio';
export { Toggle } from './lib/toggle/toggle';
export { ICON_CATEGORIES, type IconCategory, type IconName } from './icons/icons.generated';

// Feedback (DS-3): banner y toast comparten `FeedbackVariant`. Info se pinta neutral:
// el azul significa «acá se hace clic». Ver vault: Fundamentos de Marca.
export { Banner, type FeedbackVariant } from './lib/banner/banner';
export { ToastService } from './lib/toast/toast.service';
export { ToastOutlet, type Toast } from './lib/toast/toast-outlet';

// Cards (DS-3): opción dentro de `ewms-card-group`, contenedor en cualquier otro lado.
export { Card } from './lib/card/card';
export { CardGroup } from './lib/card/card-group';

// Dialog (DS-3), sobre el CDK. La confirmación no se exporta: se usa `confirm()`, así no
// hay dos caminos que terminen en dos confirmaciones distintas.
export { DialogService, type OpenDialogOptions } from './lib/dialog/dialog.service';
export { type ConfirmOptions, type DialogTone } from './lib/dialog/dialog.types';

// Select (DS-2, con la búsqueda de REQ-FE-DS3-001 desde 2026-09-21): lista corta, lista larga
// que filtra en memoria, o `SearchSource<T>`, el contrato para el backend.
export {
  Select,
  type SearchDisplay,
  type SearchPage,
  type SearchSource,
  type SearchStatus,
  type SelectMessages,
  type SelectOption,
  type SelectSearchable,
} from './lib/select/select';
export { EWMS_SELECT_MESSAGES, SELECT_SEARCH_THRESHOLD } from './lib/select/select.types';
export { SEARCH_PAGE_SIZE } from './lib/select/search-source';

// Badge (DS-3): fuera de la Tabla para que detalle, card y lista digan «con incidencia» igual.
export { Badge } from './lib/badge/badge';
export { type SemanticFamily } from './lib/feedback/feedback.types';

// Table (DS-3): `TableSource<T>` es el contrato del backend. `ArrayTableSource` se exporta para
// no reescribir filtrado y paginado en memoria. Textos y formatos son tokens (ADR 0008).
export {
  Table,
  CellTemplate,
  DetailTemplate,
  EmptyTemplate,
  TableColumn,
  type CellContext,
  type FlatRow,
} from './lib/table/table';
export { ArrayTableSource, matchesFilter, sortRows } from './lib/table/array-table-source';
export {
  emptyQuery,
  isDateRange,
  isNumberRange,
  readCell,
  type DateRange,
  type NumberRange,
  type TableFilterValue,
  type TablePage,
  type TableQuery,
  type TableSort,
  type TableSource,
} from './lib/table/table-source';
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
} from './lib/table/table.types';
export { expandableKeys, flattenTree, type FlattenOptions } from './lib/table/tree';
export { menuItemClasses, moveMenuIndex } from './lib/menu/menu';

// Split button (2026-09-21): acción principal y alternativas, sobre el menú de la Tabla.
export {
  SplitButton,
  type SplitAction,
  type SplitButtonMessages,
} from './lib/split-button/split-button';
export { EWMS_SPLIT_BUTTON_MESSAGES } from './lib/split-button/split-button.types';

// Date picker (2026-09-21): calendario propio en el idioma de la app; valor ISO o `DateRange`.
export {
  DatePicker,
  type DatePickerMessages,
  type DatePickerMode,
  type DatePickerValue,
} from './lib/date-picker/date-picker';
export { EWMS_DATE_PICKER_MESSAGES } from './lib/date-picker/date-picker.types';

// Pagination (DS-3): aparte de la tabla, porque cards, logs y colas de picking también paginan.
export { Pagination, type PaginationMessages } from './lib/pagination/pagination';

// Keyboard (DS-4, REQ-FE-DS4-001): el motor vive acá y no en `core/`. Ver vault: Atajos-de-Teclado.
// `ScanDetector` se exporta para que nadie escriba una segunda respuesta a «¿es una pistola?».
export {
  KeyboardShortcuts,
  type ShortcutEvent,
  type ShortcutOutcome,
  type Unregister,
} from './lib/keyboard/keyboard-shortcuts';
export { ShortcutsHost } from './lib/keyboard/shortcuts-host';
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

// Navigation (DS-5): ninguno conoce el router; navega el shell. `Viewport` se exporta para que
// shell y navegación den una sola respuesta al punto de corte (si no, barra y rail a la vez).
export { NavRail } from './lib/navigation/nav-rail';
export { NavBottom, BOTTOM_NAV_SLOTS } from './lib/navigation/nav-bottom';
export { Tabs, type TabsMode } from './lib/navigation/tabs';
export { Breadcrumbs } from './lib/navigation/breadcrumbs';
export { Viewport, NAV_BOTTOM_BREAKPOINT_TOKEN } from './lib/navigation/viewport';
export {
  CRUMB_FOLD_THRESHOLD,
  foldCrumbs,
  isGroup,
  parentOf,
  visibleItems,
  type Crumb,
  type NavItem,
  type Tab,
} from './lib/navigation/navigation.types';

/*
 * Favoritos (DS-5, REQ-FE-DS4-002 v1.2): `InMemoryFavoritesStore` se exporta porque lo usan
 * shell y showroom. Se pierde al recargar (decisión del usuario, 2026-09-19, hasta el
 * Security Core); un E2E afirma la pérdida para que el backend obligue a actualizar la doc.
 */
export { Favorites } from './lib/favorites/favorites';
export { FavoriteToggle } from './lib/favorites/favorite-toggle';
export { FavoritesNav, FAVORITES_SHOWN } from './lib/favorites/favorites-nav';
export { InMemoryFavoritesStore } from './lib/favorites/in-memory-favorites-store';
// `EWMS_FAVORITE_LABELS` (REQ-FE-DS4-002 v1.3): el nombre de una ruta se pregunta al pintar,
// nunca se guarda; cada aplicación pone sus palabras.
export {
  EWMS_FAVORITE_LABELS,
  EWMS_FAVORITES_STORE,
  type Favorite,
  type FavoriteLabelResolver,
  type FavoritesStore,
} from './lib/favorites/favorites.types';
