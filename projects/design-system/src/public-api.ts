/*
 * API pública de @ewms/design-system: la ÚNICA entrada legal a esta librería.
 * Nada de afuera puede meterse en src/lib/** (fronteras en eslint.config.js).
 */
export { DESIGN_SYSTEM_VERSION } from './lib/version';
export { Icon, type IconSize } from './lib/icon/icon';
export { Text, type TextVariant } from './lib/text/text';
export {
  Button,
  type ButtonIconPosition,
  type ButtonSize,
  type ButtonVariant,
} from './lib/button/button';
export { IconButton } from './lib/icon-button/icon-button';
export { Tooltip, type TooltipPosition } from './lib/tooltip/tooltip';

/*
 * Primitivas de formulario (DS-2). Las cuatro implementan ControlValueAccessor
 * por la misma base. `FieldSize` y `FieldState` se exportan UNA vez: Input y
 * Select usan la misma escala por regla, y un segundo nombre las dejaría derivar.
 */
export { type FieldSize, type FieldState } from './lib/field/field.types';
export { Input, type InputType } from './lib/input/input';
export { Checkbox } from './lib/checkbox/checkbox';
export { Radio } from './lib/radio/radio';
export { Toggle } from './lib/toggle/toggle';
export { Select, type SelectOption } from './lib/select/select';
export { ICON_CATEGORIES, type IconCategory, type IconName } from './icons/icons.generated';

/*
 * Feedback (DS-3). Dos formatos de un mensaje, un vocabulario de severidad:
 * `FeedbackVariant` se exporta una vez y el toast usa el mismo tipo. Info se
 * llama Info y se pinta `neutral`: no hay familia de color info, el azul es
 * «acá se hace clic» (Fundamentos de Marca).
 */
export { Banner, type FeedbackVariant } from './lib/banner/banner';
export { ToastService } from './lib/toast/toast.service';
export { ToastOutlet, type Toast } from './lib/toast/toast-outlet';

/*
 * Cards (DS-3). Un componente, dos usos, según dónde se escriba: opción dentro
 * de un `ewms-card-group`, contenedor en cualquier otro lado.
 */
export { Card } from './lib/card/card';
export { CardGroup } from './lib/card/card-group';

/*
 * Dialog (DS-3), sobre @angular/cdk/dialog: trampa de foco, rol, fondo inerte y
 * restauración del foco son del CDK. El componente de confirmación NO se
 * exporta -se llama `confirm()`-: dos caminos es cómo una aplicación termina
 * con dos confirmaciones distintas.
 */
export { DialogService, type OpenDialogOptions } from './lib/dialog/dialog.service';
export { type ConfirmOptions, type DialogTone } from './lib/dialog/dialog.types';

/*
 * Search select (DS-3, REQ-FE-DS3-001). `SearchSource<T>` es el contrato de
 * datos que se le pedirá al backend, no una envoltura de un endpoint: el
 * componente no sabe nada de HTTP. No sale de acá ninguna implementación en
 * memoria; la fuente de demo es código de demo y vive con la demo.
 */
export {
  SearchSelect,
  type SearchDisplay,
  type SearchPage,
  type SearchSelectMessages,
  type SearchSource,
  type SearchStatus,
} from './lib/search-select/search-select';
export { EWMS_SEARCH_SELECT_MESSAGES } from './lib/search-select/search-select.types';
export { SEARCH_PAGE_SIZE } from './lib/search-select/search-source';

/*
 * Badge (DS-3). Nació dentro de la Tabla y a propósito no vive ahí: un detalle,
 * una card y una fila de lista tienen que decir «con incidencia» igual.
 */
export { Badge } from './lib/badge/badge';
export { type SemanticFamily } from './lib/feedback/feedback.types';

/*
 * Table (DS-3). `TableSource<T>` es el contrato del backend, como
 * `SearchSource<T>`; `ArrayTableSource` sí sale porque una pantalla con los
 * datos en memoria escribiría el mismo filtrado y paginado otra vez, distinto.
 * Los textos y los formatos son TOKENS que la librería define y no implementa:
 * nada acá importa una librería de traducción (ADR 0008).
 */
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
export { menuItemClasses, moveMenuIndex } from './lib/table/row-menu';

/*
 * Pagination (DS-3). Componente propio y no una pieza de la tabla: una lista de
 * cards, un log y una cola de picking paginan, y ninguno es una tabla.
 */
export { Pagination, type PaginationMessages } from './lib/pagination/pagination';

/*
 * Keyboard (DS-4, REQ-FE-DS4-001). EL MOTOR VIVE ACÁ Y NO EN `core/`, que es la
 * v1.1 del REQ: el diálogo de ayuda necesita `DialogService`, que `core/` no
 * puede importar, y el showroom no puede importar `core/` en absoluto, con lo
 * que la lista de atajos habría quedado escrita dos veces (RFE-07 lo prohíbe).
 * `ScanDetector` se exporta porque es la respuesta a «¿es una pistola?» y nadie
 * más puede criar una segunda.
 */
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

/*
 * Navigation (DS-5). NINGUNO CONOCE EL ROUTER: reciben items, dicen cuál es el
 * actual y emiten lo elegido; navega el shell, que es lo único que sabe qué
 * significa una ruta. `Viewport` se exporta porque el shell hace la misma
 * pregunta que la navegación -¿estamos sobre el punto de corte?- y dos
 * respuestas dejarían la barra y el rail en pantalla a la vez.
 */
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
 * Favourites (DS-5, REQ-FE-DS4-002 v1.2). `EWMS_FAVORITES_STORE` es un token que
 * la librería define y no implementa; `InMemoryFavoritesStore` sí sale, porque
 * el shell y el showroom lo necesitan y «un arreglo en un campo» escrito dos
 * veces son dos cosas que derivan.
 * La lista está en memoria y SE PIERDE AL RECARGAR: costo aceptado (decisión del
 * usuario, 2026-09-19) hasta el Security Core. Un E2E afirma la pérdida, así que
 * el día que haya backend la prueba falla y obliga a actualizar los documentos.
 */
export { Favorites } from './lib/favorites/favorites';
export { FavoriteToggle } from './lib/favorites/favorite-toggle';
export { FavoritesNav, FAVORITES_SHOWN } from './lib/favorites/favorites-nav';
export { InMemoryFavoritesStore } from './lib/favorites/in-memory-favorites-store';
/*
 * `EWMS_FAVORITE_LABELS` (REQ-FE-DS4-002 v1.3): cómo se LLAMA una ruta, se
 * pregunta al pintar el bloque y no se guarda nunca. El store se provee una vez
 * por aplicación; esto son palabras, y cada aplicación pone las suyas.
 */
export {
  EWMS_FAVORITE_LABELS,
  EWMS_FAVORITES_STORE,
  type Favorite,
  type FavoriteLabelResolver,
  type FavoritesStore,
} from './lib/favorites/favorites.types';
