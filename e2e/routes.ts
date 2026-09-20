/**
 * THE ROUTES OF THE APPLICATION, IN ONE PLACE, for every level of the suite.
 *
 * `smoke` walks all of them to prove each one answers; `showroom` walks the
 * catalogue's own to check that each page renders its heading, does not scroll
 * sideways, passes axe and can be crossed with Tab exactly once per control.
 *
 * ONE LIST AND NOT TWO. Before DS-5 this list lived inside showroom.e2e.ts;
 * splitting the suite into levels would have meant copying it into smoke, and
 * a route added to one copy and not the other is a route nobody checks. That
 * is the same reason `catalog.ts` is one constant with several consumers.
 *
 * This file is NOT a spec: `testMatch` only picks up `*.e2e.ts`.
 */

export const BUTTON = '/design-system/components/button';
export const SPACING = '/design-system/foundations/spacing';
export const TEXT = '/design-system/components/text';
export const ICON_BUTTON = '/design-system/components/icon-button';
export const TOOLTIP = '/design-system/components/tooltip';
export const INPUT = '/design-system/components/input';
export const SELECT = '/design-system/components/select';
export const CHECKBOX = '/design-system/components/checkbox';
export const RADIO = '/design-system/components/radio';
export const TOGGLE = '/design-system/components/toggle';
export const BANNER = '/design-system/components/banner';
export const TOAST = '/design-system/components/toast';
export const CARD = '/design-system/components/card';
export const DIALOG = '/design-system/components/dialog';
export const SEARCH_SELECT = '/design-system/components/search-select';
export const TABLE = '/design-system/components/table';
export const PAGINATION = '/design-system/components/pagination';
export const KEYBOARD = '/design-system/patterns/keyboard';
export const SEARCH_CREATE_EDIT = '/design-system/patterns/search-create-edit';

/**
 * Every navigable route. Twenty-four since DS-4: the twenty-two of DS-3 plus
 * the two pattern pages, which is what "nothing built is undocumented" looks
 * like when it is a test rather than a promise.
 *
 * Adding a route here is what subjects it to the four checks below that every
 * page owes: its heading renders, it does not scroll sideways at 1440 or 1280,
 * axe finds nothing, and Tab reaches every control exactly once.
 */
export const PAGES = [
  { url: '/design-system', heading: 'Showroom del sistema de diseño' },
  { url: '/design-system/foundations/brand', heading: 'Marca' },
  { url: '/design-system/foundations/colors', heading: 'Color' },
  { url: '/design-system/foundations/typography', heading: 'Tipografía' },
  { url: SPACING, heading: 'Espaciado, radios y elevación' },
  { url: '/design-system/foundations/icons', heading: 'Iconografía' },
  { url: BUTTON, heading: 'Botón' },
  { url: TEXT, heading: 'Texto' },
  { url: ICON_BUTTON, heading: 'Icon Button' },
  { url: TOOLTIP, heading: 'Tooltip' },
  { url: INPUT, heading: 'Input' },
  { url: SELECT, heading: 'Select / Dropdown' },
  { url: CHECKBOX, heading: 'Checkbox' },
  { url: RADIO, heading: 'Radio' },
  { url: TOGGLE, heading: 'Toggle' },
  { url: BANNER, heading: 'Banner' },
  { url: TOAST, heading: 'Toast' },
  { url: CARD, heading: 'Card' },
  { url: DIALOG, heading: 'Dialog' },
  { url: SEARCH_SELECT, heading: 'Selector con búsqueda' },
  { url: TABLE, heading: 'Tabla de datos' },
  { url: PAGINATION, heading: 'Paginación' },
  { url: KEYBOARD, heading: 'Atajos de teclado' },
  { url: SEARCH_CREATE_EDIT, heading: 'Buscar, crear, editar' },
] as const;
