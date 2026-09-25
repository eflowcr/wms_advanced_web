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
 * Presupuesto por ruta de las pruebas que recorren muchas en una sola: el tope de 30 s es de una
 * prueba, no de 28 páginas, y con el servidor en frío la primera vuelta se lo comía entero.
 */
export const ROUTE_BUDGET_MS = 3_000;

/**
 * Las rutas navegables del catálogo, patrones incluidos, con su título en los dos idiomas. Sumarla
 * acá la somete a las pruebas de showroom: título, sin desborde a 1440 y 1280, axe limpio, Tab una
 * vez por control, y la página entera en inglés.
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
  {
    url: '/design-system',
    heading: { es: 'Showroom del sistema de diseño', en: 'Design system showroom' },
  },
  { url: '/design-system/foundations/brand', heading: { es: 'Marca', en: 'Brand' } },
  { url: '/design-system/foundations/colors', heading: { es: 'Color', en: 'Colour' } },
  { url: '/design-system/foundations/typography', heading: { es: 'Tipografía', en: 'Typography' } },
  {
    url: SPACING,
    heading: { es: 'Espaciado, radios y elevación', en: 'Spacing, radii and elevation' },
  },
  { url: '/design-system/foundations/icons', heading: { es: 'Iconografía', en: 'Iconography' } },
  { url: BUTTON, heading: { es: 'Botón', en: 'Button' } },
  { url: TEXT, heading: { es: 'Texto', en: 'Text' } },
  { url: TOOLTIP, heading: { es: 'Tooltip', en: 'Tooltip' } },
  { url: INPUT, heading: { es: 'Input', en: 'Input' } },
  { url: SELECT, heading: { es: 'Select', en: 'Select' } },
  { url: CHECKBOX, heading: { es: 'Checkbox', en: 'Checkbox' } },
  { url: RADIO, heading: { es: 'Radio', en: 'Radio' } },
  { url: TOGGLE, heading: { es: 'Toggle', en: 'Toggle' } },
  { url: BANNER, heading: { es: 'Banner', en: 'Banner' } },
  { url: TOAST, heading: { es: 'Toast', en: 'Toast' } },
  { url: CARD, heading: { es: 'Card', en: 'Card' } },
  { url: DIALOG, heading: { es: 'Dialog', en: 'Dialog' } },
  { url: TABLE, heading: { es: 'Tabla de datos', en: 'Data table' } },
  { url: PAGINATION, heading: { es: 'Paginación', en: 'Pagination' } },
  { url: SPLIT_BUTTON, heading: { es: 'Split button', en: 'Split button' } },
  { url: DATE_PICKER, heading: { es: 'Date picker', en: 'Date picker' } },
  { url: NAVIGATION, heading: { es: 'Navegación', en: 'Navigation' } },
  { url: KEYBOARD, heading: { es: 'Atajos de teclado', en: 'Keyboard shortcuts' } },
  { url: SEARCH_CREATE_EDIT, heading: { es: 'Buscar, crear, editar', en: 'Search, create, edit' } },
  { url: EMPTY_STATE, heading: { es: 'Estado vacío', en: 'Empty state' } },
  { url: FILTERS, heading: { es: 'Filtros', en: 'Filters' } },
  { url: FORM, heading: { es: 'Formulario', en: 'Form' } },
] as const;
