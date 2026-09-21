/**
 * Las rutas de la app en una sola lista para todos los niveles: dos copias dejan rutas sin revisar.
 * No es un spec: testMatch solo toma los .e2e.ts.
 */

export const BUTTON = '/design-system/components/button';
export const SPACING = '/design-system/foundations/spacing';
export const TEXT = '/design-system/components/text';
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
 * Las 23 rutas navegables (21 componentes y fundamentos más dos patrones). Sumarla acá la somete a las cuatro
 * pruebas de showroom: título, sin desborde a 1440 y 1280, axe limpio y Tab una vez por control.
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
