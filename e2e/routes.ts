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
export const TABLE = '/design-system/components/table';
export const PAGINATION = '/design-system/components/pagination';
export const SPLIT_BUTTON = '/design-system/components/split-button';
export const DATE_PICKER = '/design-system/components/date-picker';
export const NAVIGATION = '/design-system/components/navigation';
export const KEYBOARD = '/design-system/patterns/keyboard';
export const SEARCH_CREATE_EDIT = '/design-system/patterns/search-create-edit';
export const EMPTY_STATE = '/design-system/patterns/empty-state';
export const FILTERS = '/design-system/patterns/filters';
export const FORM = '/design-system/patterns/form';

/**
 * Las rutas navegables del catálogo, patrones incluidos. Sumarla acá la somete a las cuatro
 * pruebas de showroom: título, sin desborde a 1440 y 1280, axe limpio y Tab una vez por control.
 */
/**
 * Los trece destinos del menú sin pantalla: van a «En construcción», nunca a un 404. El router
 * los deriva de `shell/layout/menu.ts`; acá se declaran porque e2e no importa de `projects/`.
 * Si una ruta se cae del menú, la prueba de smoke que las recorre pierde el `h1` que espera.
 */
export const UNDER_CONSTRUCTION = [
  { url: '/catalogos/articulos', heading: /^(Artículos|Articles)$/ },
  { url: '/catalogos/clientes', heading: /^(Clientes|Customers)$/ },
  { url: '/catalogos/proveedores', heading: /^(Proveedores|Suppliers)$/ },
  { url: '/catalogos/ubicaciones', heading: /^(Ubicaciones|Locations)$/ },
  { url: '/catalogos/almacenes', heading: /^(Almacenes|Warehouses)$/ },
  { url: '/catalogos/unidades', heading: /^(Unidades|Units)$/ },
  { url: '/catalogos/lotes', heading: /^(Lotes|Lots)$/ },
  { url: '/catalogos/series', heading: /^(Series|Serial numbers)$/ },
  { url: '/catalogos/transportistas', heading: /^(Transportistas|Carriers)$/ },
  { url: '/catalogos/tarifas', heading: /^(Tarifas|Rates)$/ },
  { url: '/configuracion/usuarios', heading: /^(Usuarios|Users)$/ },
  { url: '/configuracion/perfiles', heading: /^(Perfiles|Profiles)$/ },
  { url: '/configuracion/parametros', heading: /^(Parámetros|Parameters)$/ },
] as const;

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
  { url: SELECT, heading: 'Select' },
  { url: CHECKBOX, heading: 'Checkbox' },
  { url: RADIO, heading: 'Radio' },
  { url: TOGGLE, heading: 'Toggle' },
  { url: BANNER, heading: 'Banner' },
  { url: TOAST, heading: 'Toast' },
  { url: CARD, heading: 'Card' },
  { url: DIALOG, heading: 'Dialog' },
  { url: TABLE, heading: 'Tabla de datos' },
  { url: PAGINATION, heading: 'Paginación' },
  { url: SPLIT_BUTTON, heading: 'Split button' },
  { url: DATE_PICKER, heading: 'Date picker' },
  { url: NAVIGATION, heading: 'Navegación' },
  { url: KEYBOARD, heading: 'Atajos de teclado' },
  { url: SEARCH_CREATE_EDIT, heading: 'Buscar, crear, editar' },
  { url: EMPTY_STATE, heading: 'Estado vacío' },
  { url: FILTERS, heading: 'Filtros' },
  { url: FORM, heading: 'Formulario' },
] as const;
