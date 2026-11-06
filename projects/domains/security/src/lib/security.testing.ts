import {
  EWMS_DATE_PICKER_MESSAGES,
  EWMS_FILTER_BAR_MESSAGES,
  EWMS_FILTER_CHIPS_MESSAGES,
  EWMS_FORM_MESSAGES,
  EWMS_PAGINATION_MESSAGES,
  EWMS_SELECT_MESSAGES,
  EWMS_SPLIT_BUTTON_MESSAGES,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
} from '@ewms/design-system';
import { TRANSLOCO_MISSING_HANDLER } from '@jsverse/transloco';

/** Un texto del sistema de diseño es su clave, se lea como texto o se llame con argumentos. */
const word = (key: string) => Object.assign(() => key, { toString: () => key });
const words = (keys: string): Record<string, unknown> =>
  Object.fromEntries(keys.split(' ').map((key) => [key, word(key)]));
const TABLE_KEYS =
  'search filterPlaceholder filterFrom filterTo selectAll selectRow expand collapse rowMenu ' +
  'loadingChildren childrenFailed retry sortedAscending sortedDescending filters clearFilters ' +
  'searchChip view resetView expandAll collapseAll density views viewInitial viewName saveAsNew ' +
  'saveChanges renameView duplicateView deleteView defaultView deleteViewTitle viewModified ' +
  'viewCopyName viewDefaultLabel densityMd densitySm setAll setNone setSummary setChosen columns ' +
  'resizeColumn moveEarlier moveLater columnMoved columnMenu columnActions sortPriority ' +
  'selectedCount clearSelection confirmTitle confirmBody confirmCancel copied export ' +
  'exportSelected copyAll loading loadFailed noData noResults noResultsHint rowsShown aggregate ' +
  'totalsScope totalUnavailable';
export const DESIGN_SYSTEM_WORDS = [
  { provide: EWMS_TABLE_MESSAGES, useValue: words(TABLE_KEYS) },
  { provide: EWMS_FILTER_BAR_MESSAGES, useValue: words('moreFilters fewerFilters') },
  { provide: EWMS_FILTER_CHIPS_MESSAGES, useValue: words('removeFilter clearFilters activeCount') },
  {
    provide: EWMS_FORM_MESSAGES,
    useValue: {
      ...words('customError errorSummary errorSummaryLabel requiredLegend'),
      errors: new Proxy({}, { get: (_, kind) => word(String(kind)) }),
    },
  },
  { provide: EWMS_PAGINATION_MESSAGES, useValue: words('previousPage nextPage pageOf rowsTotal') },
  { provide: EWMS_SELECT_MESSAGES, useValue: words('searching noResults error retry more results') },
  { provide: EWMS_SPLIT_BUTTON_MESSAGES, useValue: words('moreActions') },
];

/** Lo que una pantalla de Seguridad pide para pintarse en una prueba, además de Transloco. */
export function provideSecurityRendering() {
  return [
    { provide: TRANSLOCO_MISSING_HANDLER, useValue: { handle: (key: string) => key } },
    ...DESIGN_SYSTEM_WORDS,
    {
      provide: EWMS_TABLE_FORMATTERS,
      useValue: { number: (value: number) => String(value), date: (value: string) => value },
    },
    {
      provide: EWMS_DATE_PICKER_MESSAGES,
      useValue: { chooseDate: 'date', previousMonth: 'previous', nextMonth: 'next' },
    },
  ];
}
