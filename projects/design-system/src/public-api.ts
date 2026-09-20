/*
 * Public API surface of @ewms/design-system
 *
 * This is the ONLY legal entry point into this library. Nothing outside it may
 * reach into src/lib/** directly -- see the boundary rules in eslint.config.js.
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
 * Form primitives (DS-2). All four implement ControlValueAccessor through the
 * one base in lib/forms, so `formControlName` and `ngModel` reach every one of
 * them the same way.
 *
 * `FieldSize` and `FieldState` are exported once, from the field module, and
 * shared by Input and Select: the two use the same control scale by rule, not
 * by coincidence, and a second name for it would let them drift apart.
 */
export { type FieldSize, type FieldState } from './lib/field/field.types';
export { Input, type InputType } from './lib/input/input';
export { Checkbox } from './lib/checkbox/checkbox';
export { Radio } from './lib/radio/radio';
export { Toggle } from './lib/toggle/toggle';
export { Select, type SelectOption } from './lib/select/select';
export { ICON_CATEGORIES, type IconCategory, type IconName } from './icons/icons.generated';

/*
 * Feedback (DS-3). Two formats of one message, one vocabulary of severity.
 *
 * `FeedbackVariant` is exported once, from the banner, and the toast uses the
 * same type: a screen that raises a danger banner and a danger toast must not
 * be able to spell the two differently.
 *
 * Info is called Info and is painted `neutral`. There is no `info` colour
 * family and there is not going to be one -- the blue means "you click this"
 * (Fundamentos de Marca).
 */
export { Banner, type FeedbackVariant } from './lib/banner/banner';
export { ToastService } from './lib/toast/toast.service';
export { ToastOutlet, type Toast } from './lib/toast/toast-outlet';

/*
 * Cards (DS-3). One component, two uses, decided by where it is written: an
 * option when it is inside an `ewms-card-group`, a container anywhere else.
 */
export { Card } from './lib/card/card';
export { CardGroup } from './lib/card/card-group';

/*
 * Dialog (DS-3). Over @angular/cdk/dialog: the focus trap, the role, the
 * inert background and the focus restoration are the CDK's, and are not
 * rebuilt here. What this library adds is the two shapes a dialog takes.
 *
 * The confirmation component itself is NOT exported: a consumer calls
 * `confirm()` and gets a promise. A second way to raise a confirmation is how
 * two confirmations in one application end up looking different.
 */
export { DialogService, type OpenDialogOptions } from './lib/dialog/dialog.service';
export { type ConfirmOptions, type DialogTone } from './lib/dialog/dialog.types';

/*
 * Search select (DS-3, REQ-FE-DS3-001).
 *
 * `SearchSource<T>` is the data contract the backend will be asked for, not a
 * wrapper over an endpoint that exists. The component knows nothing about
 * HTTP; moving from a demo source to a real one changes an implementation of
 * that interface and nothing else.
 *
 * No in-memory implementation ships from here. A demo source is demo code and
 * lives with the demo; the library would carry it into every production bundle
 * for the sake of one page.
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
 * Badge (DS-3). Born inside the Table and deliberately not living there: a
 * detail header, a card and a list row all need to say "con incidencia" the
 * same way.
 */
export { Badge } from './lib/badge/badge';
export { type SemanticFamily } from './lib/feedback/feedback.types';

/*
 * Table (DS-3).
 *
 * `TableSource<T>` is the contract the backend will be asked for, like
 * `SearchSource<T>`. `ArrayTableSource` ships because a screen whose data
 * already fits in memory would otherwise write the same filtering and paging
 * again, slightly differently.
 *
 * The texts and the formatters are INJECTION TOKENS the library defines and
 * does not implement: the shell provides them once from core/i18n, the
 * showroom provides its own. Nothing here imports a translation library, which
 * is what ADR 0008 protects.
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
 * Pagination (DS-3). Its own component, not a piece of the table: a list of
 * cards, a log and a picking queue all page, and none of them is a table. It
 * closes the gap the catalogue had reserved since DS-2.
 */
export { Pagination, type PaginationMessages } from './lib/pagination/pagination';

/*
 * Keyboard (DS-4, REQ-FE-DS4-001).
 *
 * THE ENGINE LIVES HERE AND NOT IN `core/`, which is v1.1 of the REQ and a
 * decision rather than a drift. Two things forced it. The help dialog is user
 * interface and needs `DialogService`, which `core/` may not import; and the
 * showroom, where the example screen lives, may not import `core/` at all --
 * so an engine in `core/` meant the list of shortcuts written twice, which
 * RFE-07 forbids in as many words. Putting it here also let the scanner burst
 * detection that `ewms-search-select` already had become the only one.
 *
 * `EWMS_SHORTCUT_MAP` and `EWMS_SHORTCUT_HELP_MESSAGES` are injection tokens
 * the library defines and does not implement, exactly like the table's. Each
 * application provides its own map, so each application has ONE file that
 * names keys -- which is what RFE-01 asks for.
 *
 * `ScanDetector` is exported because it is the answer to "is this a barcode
 * gun?" and nothing else may grow a second one.
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
 * Navigation (DS-5). The three pieces the App Shell is assembled from, and the
 * fourth that replaces the rail on a narrow screen.
 *
 * NONE OF THEM KNOWS THE ROUTER. They take items, say which one is current,
 * and emit what was chosen; the shell, which is the only thing that knows what
 * a route means, navigates. That is what lets the showroom demonstrate a live
 * navigation tree with no router in the page, and what keeps a second
 * application from inheriting this one's route tree.
 *
 * `Viewport` is exported because the shell has to ask the same question the
 * navigation asks -- are we above the breakpoint? -- and two answers to it
 * would let the bar and the rail be on screen at once.
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
 * Favourites (DS-5, REQ-FE-DS4-002 v1.2).
 *
 * `EWMS_FAVORITES_STORE` is an injection token the library defines and does
 * not implement, like the table's messages and the shortcut map. What DOES
 * ship is `InMemoryFavoritesStore`, for the reason `ArrayTableSource` ships:
 * the shell and the showroom both need it, and "an array in a field" written
 * twice is two things that drift. A backend implementation is a different
 * matter and will not live here.
 *
 * The list is in memory and IS LOST ON RELOAD. That is the accepted cost of
 * the user's decision of 2026-09-19, it opens no ESLint exception, and it ends
 * when the Security Core exists (PLN-WMS-005, Sprint 1). An end-to-end test
 * asserts the loss, so the day somebody connects a backend the test fails and
 * forces the documents to be updated.
 */
export { Favorites } from './lib/favorites/favorites';
export { FavoriteToggle } from './lib/favorites/favorite-toggle';
export { FavoritesNav, FAVORITES_SHOWN } from './lib/favorites/favorites-nav';
export { InMemoryFavoritesStore } from './lib/favorites/in-memory-favorites-store';
export {
  EWMS_FAVORITES_STORE,
  type Favorite,
  type FavoritesStore,
} from './lib/favorites/favorites.types';
