/**
 * THE catalogue. One constant, several consumers: the sidebar, the home page
 * index and the search box all read this list and nothing else.
 *
 * If each of them carried its own copy they would disagree within a fortnight,
 * and the catalogue's whole job is to be the place where you find out what
 * already exists.
 *
 * Pages that do not exist yet are listed too, with their state visible and no
 * link. A gap you can see is information; a gap you cannot see is something
 * everyone forgets. (Showroom spec, section 6.)
 */

/**
 * How far along a catalogue entry is. The four values are deliberately about
 * the WORK, not about the page: `built` means the component compiles and is
 * tested but nobody has written its sheet yet, which is a different problem
 * from `documented`, where the sheet exists and the code does not.
 */
export type CatalogStatus =
  /** Page written and navigable. */
  | 'ready'
  /** Component built and green; its sheet in the showroom is still missing. */
  | 'built'
  /** Sheet written in the vault; the component is not built. */
  | 'documented'
  /** Reserved slot: neither sheet nor code, kept visible so it is not forgotten. */
  | 'gap';

export interface CatalogEntry {
  readonly id: string;
  /** Shown in the sidebar and the index. Spanish, like the rest of the pages. */
  readonly name: string;
  /** The Angular selector, so the search finds a component by what you type in a template. */
  readonly selector: string | null;
  /** Absolute route, or null when there is no page to go to yet. */
  readonly route: string | null;
  readonly status: CatalogStatus;
  /** One line on what it is, or on why it is not here yet. */
  readonly note: string;
}

export interface CatalogSection {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly CatalogEntry[];
}

/** Where the showroom is mounted by the shell (app.routes.ts). */
export const SHOWROOM_BASE = '/design-system';

const FOUNDATIONS: readonly CatalogEntry[] = [
  {
    id: 'brand',
    name: 'Marca',
    selector: null,
    route: `${SHOWROOM_BASE}/foundations/brand`,
    status: 'ready',
    note: 'Logo, variantes, fondos, tamaño mínimo, área de resguardo y usos incorrectos.',
  },
  {
    id: 'colors',
    name: 'Color',
    selector: null,
    route: `${SHOWROOM_BASE}/foundations/colors`,
    status: 'ready',
    note: 'Primitivos y semánticos, con el contraste calculado en vivo.',
  },
  {
    id: 'typography',
    name: 'Tipografía',
    selector: null,
    route: `${SHOWROOM_BASE}/foundations/typography`,
    status: 'ready',
    note: 'Montserrat y la escala H1-H4 / P / Caption / Mono, al tamaño real.',
  },
  {
    id: 'spacing',
    name: 'Espaciado, radios y elevación',
    selector: null,
    route: `${SHOWROOM_BASE}/foundations/spacing`,
    status: 'ready',
    note: 'Base 4, los cinco radios, las tres alturas de control y las tres sombras.',
  },
  {
    id: 'icons',
    name: 'Iconografía',
    selector: 'ewms-icon',
    route: `${SHOWROOM_BASE}/foundations/icons`,
    status: 'ready',
    note: 'Catálogo cerrado de 70 iconos Tabler, con el trazo compensado por tamaño.',
  },
];

const COMPONENTS: readonly CatalogEntry[] = [
  {
    id: 'button',
    name: 'Botón',
    selector: 'ewms-button',
    route: `${SHOWROOM_BASE}/components/button`,
    status: 'ready',
    note: 'Cuatro variantes, tres tamaños y el patrón anti-doble-envío.',
  },
  {
    id: 'text',
    name: 'Texto',
    selector: 'ewms-text',
    route: `${SHOWROOM_BASE}/components/text`,
    status: 'ready',
    note:
      'Las siete variantes semánticas, y por qué el nivel visual no se separa del nivel del documento.',
  },
  {
    id: 'icon-button',
    name: 'Icon Button',
    selector: 'ewms-icon-button',
    route: `${SHOWROOM_BASE}/components/icon-button`,
    status: 'ready',
    note:
      'Cuadrado en los tres tamaños, con label y tooltip obligatorios en el tipo.',
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    selector: 'ewmsTooltip',
    route: `${SHOWROOM_BASE}/components/tooltip`,
    status: 'ready',
    note:
      'Directiva, no componente. Las tres reglas de la 1.4.13 y la trampa del nombre disabled.',
  },
  {
    id: 'input',
    name: 'Input',
    selector: 'ewms-input',
    route: `${SHOWROOM_BASE}/components/input`,
    status: 'ready',
    note:
      'Cinco tipos, ControlValueAccessor, y la altura compartida con el Botón del mismo tamaño.',
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    selector: 'ewms-checkbox',
    route: `${SHOWROOM_BASE}/components/checkbox`,
    status: 'ready',
    note:
      'Caja de 18×18 con tercer estado indeterminado, para el «seleccionar todos».',
  },
  {
    id: 'radio',
    name: 'Radio',
    selector: 'ewms-radio',
    route: `${SHOWROOM_BASE}/components/radio`,
    status: 'ready',
    note:
      'La misma caja que el Checkbox, agrupada por name nativo y sin tercer estado.',
  },
  {
    id: 'toggle',
    name: 'Toggle',
    selector: 'ewms-toggle',
    route: `${SHOWROOM_BASE}/components/toggle`,
    status: 'ready',
    note:
      'Pista de 44×24 con pulgar de 20. Aplica al tocar: si hay un Guardar al lado, va Checkbox.',
  },
  {
    id: 'select',
    name: 'Select / Dropdown',
    selector: 'ewms-select',
    route: `${SHOWROOM_BASE}/components/select`,
    status: 'ready',
    note:
      'Panel en overlay del CDK, con el teclado y el volteo que jsdom no podía probar.',
  },
  {
    id: 'table',
    name: 'Tabla de datos',
    selector: null,
    route: null,
    status: 'documented',
    note: 'Con ficha en el vault, sin construir.',
  },
  {
    id: 'modal',
    name: 'Modal / Dialog',
    selector: null,
    route: null,
    status: 'documented',
    note: 'Con ficha en el vault, sin construir.',
  },
  {
    id: 'cards',
    name: 'Card',
    selector: 'ewms-card',
    route: `${SHOWROOM_BASE}/components/card`,
    status: 'ready',
    note:
      'Dos usos bajo un nombre: opción dentro de un grupo, contenedor fuera de él. Lo decide el inyector.',
  },
  {
    id: 'banner',
    name: 'Banner',
    selector: 'ewms-banner',
    route: `${SHOWROOM_BASE}/components/banner`,
    status: 'ready',
    note:
      'Mensaje en el flujo, cuatro severidades. Info se llama Info y se pinta neutral.',
  },
  {
    id: 'toast',
    name: 'Toast',
    selector: 'ewms-toast-outlet',
    route: `${SHOWROOM_BASE}/components/toast`,
    status: 'ready',
    note: 'Cola compartida con una sola región viva. Es un servicio, no una etiqueta.',
  },
  {
    id: 'navigation',
    name: 'Navegación',
    selector: null,
    route: null,
    status: 'documented',
    note: 'Rail, tabs y breadcrumbs en una sola ficha. Sin construir.',
  },
  {
    id: 'split-button',
    name: 'Split button',
    selector: null,
    route: null,
    status: 'gap',
    note: 'Hueco reservado, sin ficha. El patrón «Descargar / PDF / Excel / CSV».',
  },
  {
    id: 'date-picker',
    name: 'Date picker',
    selector: null,
    route: null,
    status: 'gap',
    note: 'Hueco reservado, sin ficha.',
  },
  {
    id: 'pagination',
    name: 'Paginación',
    selector: null,
    route: null,
    status: 'gap',
    note: 'Hueco reservado, sin ficha.',
  },
];

const PATTERNS: readonly CatalogEntry[] = [
  {
    id: 'pattern-form',
    name: 'Formulario',
    selector: null,
    route: null,
    status: 'gap',
    note: 'Composición pendiente.',
  },
  {
    id: 'pattern-filters',
    name: 'Filtros',
    selector: null,
    route: null,
    status: 'gap',
    note: 'Composición pendiente.',
  },
  {
    id: 'pattern-empty',
    name: 'Estado vacío',
    selector: null,
    route: null,
    status: 'gap',
    note: 'Composición pendiente.',
  },
];

export const CATALOG: readonly CatalogSection[] = [
  { id: 'foundations', title: 'Fundamentos', entries: FOUNDATIONS },
  { id: 'components', title: 'Componentes', entries: COMPONENTS },
  { id: 'patterns', title: 'Patrones', entries: PATTERNS },
];

/** Human-readable badge for an entry that has no page. */
export const STATUS_LABELS: Readonly<Record<CatalogStatus, string>> = {
  ready: '',
  built: '(pendiente)',
  documented: '(pendiente)',
  gap: '(pendiente)',
};

/**
 * Filters the catalogue by name and by selector, keeping the sections so the
 * sidebar does not reshuffle while you type. Sections that end up empty are
 * dropped: an empty heading reads like a broken page.
 */
export function filterCatalog(query: string): readonly CatalogSection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return CATALOG;
  }
  return CATALOG.map((section) => ({
    ...section,
    entries: section.entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(needle) ||
        (entry.selector?.toLowerCase().includes(needle) ?? false),
    ),
  })).filter((section) => section.entries.length > 0);
}

/** How many entries a filtered catalogue holds, for the result count. */
export function countEntries(sections: readonly CatalogSection[]): number {
  return sections.reduce((total, section) => total + section.entries.length, 0);
}
