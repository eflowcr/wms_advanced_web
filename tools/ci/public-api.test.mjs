// La API pública de @ewms/design-system, nombre por nombre. El barril reexporta con `export *` para
// que el bundle pode; esta lista impide que un `export` interno se vuelva público sin decidirlo.
// Ver vault: 02-Arquitectura/Anatomia del Workspace.md.
import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Los nombres que exporta un public-api.ts, resueltos por el compilador. */
function exportedNames(file) {
  const program = ts.createProgram([file], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Preserve,
    experimentalDecorators: true,
    skipLibCheck: true,
    noEmit: true,
  });
  const checker = program.getTypeChecker();
  const module = checker.getSymbolAtLocation(program.getSourceFile(file));
  return checker
    .getExportsOfModule(module)
    .map((symbol) => symbol.name)
    .sort();
}

const DESIGN_SYSTEM = [
  'ArrayTableSource',
  'Badge',
  'BadgeDescriptor',
  'BadgeDictionary',
  'Banner',
  'Breadcrumbs',
  'BulkActionEvent',
  'Button',
  'ButtonGround',
  'ButtonIconPosition',
  'ButtonSize',
  'ButtonVariant',
  'Card',
  'CardGroup',
  'CellContext',
  'CellTemplate',
  'Checkbox',
  'ColumnAction',
  'ConfirmOptions',
  'Crumb',
  'DESIGN_SYSTEM_VERSION',
  'DatePicker',
  'DatePickerMessages',
  'DatePickerMode',
  'DatePickerValue',
  'DateRange',
  'DetailTemplate',
  'DialogService',
  'DialogVariant',
  'EWMS_DATE_PICKER_MESSAGES',
  'EWMS_FAVORITES_STORE',
  'EWMS_FAVORITE_LABELS',
  'EWMS_FILTER_BAR_MESSAGES',
  'EWMS_FILTER_CHIPS_MESSAGES',
  'EWMS_FORM_MESSAGES',
  'EWMS_PAGINATION_MESSAGES',
  'EWMS_SEARCH_BOX_MESSAGES',
  'EWMS_SELECT_MESSAGES',
  'EWMS_SHORTCUT_HELP_MESSAGES',
  'EWMS_SHORTCUT_MAP',
  'EWMS_SPLIT_BUTTON_MESSAGES',
  'EWMS_TABLE_FORMATTERS',
  'EWMS_TABLE_MESSAGES',
  'EWMS_TABLE_VIEW_STORE',
  'EmptyState',
  'EmptyStateAction',
  'EmptyStateKind',
  'EmptyStateSize',
  'EmptyTemplate',
  'ExportRequest',
  'Favorite',
  'FavoriteLabelResolver',
  'FavoriteToggle',
  'Favorites',
  'FavoritesNav',
  'FavoritesStore',
  'FeedbackVariant',
  'FieldSize',
  'FilterBar',
  'FilterBarMessages',
  'FilterChipsMessages',
  'FilterField',
  'FilterFieldValue',
  'FilterValues',
  'FormAction',
  'FormErrorKind',
  'FormErrorWriter',
  'FormErrorWriters',
  'FormMessages',
  'FormPattern',
  'ICON_CATEGORIES',
  'Icon',
  'IconCategory',
  'IconName',
  'IconSize',
  'InMemoryFavoritesStore',
  'InMemoryTableViewStore',
  'Input',
  'InputType',
  'KeyboardShortcuts',
  'MenuItem',
  'NavBottom',
  'NavItem',
  'NavRail',
  'NumberRange',
  'OpenDialogOptions',
  'Pagination',
  'PaginationMessages',
  'Radio',
  'RadioGroup',
  'RowActivateEvent',
  'RowMenuEvent',
  'RowState',
  'SCAN_MIN_KEYSTROKES',
  'SCAN_THRESHOLD_TOKEN',
  'SEARCH_PAGE_SIZE',
  'ScanDetector',
  'ScanVerdict',
  'SavedTableView',
  'SearchBox',
  'SearchBoxMessages',
  'SearchDisplay',
  'SearchPage',
  'SearchSource',
  'Select',
  'SelectMessages',
  'SelectOption',
  'SemanticFamily',
  'SetFilter',
  'ShortcutAction',
  'ShortcutBinding',
  'ShortcutEvent',
  'ShortcutHelpMessages',
  'ShortcutMap',
  'ShortcutOutcome',
  'ShortcutsHost',
  'SplitAction',
  'SplitButton',
  'SplitButtonMessages',
  'Tab',
  'TABLE_VIEWS_VERSION',
  'Table',
  'TableAggregate',
  'TableChildren',
  'TableColumn',
  'TableColumnLimit',
  'TableColumnType',
  'TableColumnWidth',
  'TableDensity',
  'TableFilterValue',
  'TableFormatters',
  'TableMessages',
  'TablePage',
  'TablePin',
  'TableQuery',
  'TableSavedState',
  'TableSort',
  'TableSource',
  'TableTotalsScope',
  'TableView',
  'TableViewStore',
  'TableViewsDocument',
  'Tabs',
  'TabsMode',
  'Text',
  'TextVariant',
  'Toast',
  'ToastOutlet',
  'ToastService',
  'Toggle',
  'Tooltip',
  'TooltipPosition',
  'Unregister',
  'Viewport',
  'confirmDiscard',
  'isDateRange',
  'isNumberRange',
  'isSetFilter',
  'isSingleCharacter',
  'parentOf',
  'parseTableDate',
  'parseTableViews',
  'readMilliseconds',
  'readPixels',
];

describe('the public API of @ewms/design-system', () => {
  it('exports exactly the agreed names: adding one is a decision, not a side effect', () => {
    const file = path.join(ROOT, 'projects/design-system/src/public-api.ts');
    assert.deepEqual(exportedNames(file), [...DESIGN_SYSTEM].sort());
  });
});

// Las entradas de seguridad exportan lo que se importa fuera de su biblioteca (ADR 0015).
const CORE_SECURITY = [
  'AccessContext', 'AccessResult', 'AccessStore', 'ActiveContext', 'Actor', 'Affiliation',
  'Assignment', 'AuthError', 'AuthErrorCode', 'AuthSession', 'Can', 'ContextChangeCode',
  'ContextChangeError', 'Grants', 'HttpSecurityGateway', 'Profile', 'ReviewCampaign',
  'ReviewDecision', 'ReviewItem', 'SCREEN_CATALOG', 'SECURITY_API_URL', 'SENSITIVE_CAPABILITIES',
  'STEP_UP', 'ScreenDefinition', 'SecurityAdministration', 'SecurityError', 'SecurityErrorCode',
  'SecurityGateway', 'SecurityRequest', 'SecuritySnapshot', 'SecurityUser', 'SessionGrant',
  'SessionInfo', 'accessCode', 'accessGuard', 'assignableTo', 'authInterceptor', 'capabilities',
  'effectiveAccess', 'inForce', 'internalCapability', 'isoToday', 'parsePermission',
  'safeReturnUrl', 'sameContext', 'securityAccessInterceptor', 'sessionGuard',
];
const CORE_LOCALE = ['provideEwmsLocale'];
const SECURITY = ['MemoryOptions', 'MemorySecurityGateway', 'demoSnapshot', 'securityRoutes', 'userRoutes'];

describe('the public API of the security entry points', () => {
  for (const [alias, file, names] of [
    ['@ewms/core/security', 'projects/core/src/security-api.ts', CORE_SECURITY],
    ['@ewms/core/locale', 'projects/core/src/locale-api.ts', CORE_LOCALE],
    ['@ewms/security', 'projects/domains/security/src/public-api.ts', SECURITY],
  ]) {
    it(`${alias} exports exactly what is imported outside its library`, () => {
      assert.deepEqual(exportedNames(path.join(ROOT, file)), [...names].sort());
    });
  }
});
