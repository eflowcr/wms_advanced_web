// Única entrada a la biblioteca (ver límites en eslint.config.js). Nada del proyecto entra acá.
export {
  filtersInUrl,
  type UrlFilters,
  type UrlFilterState,
  type UrlFilterValue,
} from './lib/filters-in-url';
export {
  CANCEL_MAX_CLICKS,
  CREATE_MAX_CLICKS,
  EDIT_MAX_CLICKS,
  OPEN_FAVORITE_MAX_CLICKS,
  SEARCH_MAX_CLICKS,
  type FlowId,
} from './lib/click-budget';
