// Nombres públicos de la Tabla; el barril lo reexporta con `export *` (ver public-api.ts).
export { ArrayTableSource } from './array-table-source';
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
} from './table-source';
export {
  EWMS_TABLE_VIEW_STORE,
  InMemoryTableViewStore,
  parseTableViews,
  TABLE_VIEWS_VERSION,
  type SavedTableView,
  type TableSavedState,
  type TableViewStore,
  type TableViewsDocument,
} from './table-saved-views.types';
