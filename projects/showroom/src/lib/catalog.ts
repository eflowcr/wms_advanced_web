/*
 * El catálogo: única lista que leen la barra lateral, el índice y la búsqueda. Las páginas que
 * aún no existen también figuran, sin enlace: un hueco visible es información
 * (Ver vault: Showroom - Especificacion §6).
 */

/** Avance de una entrada, sobre el trabajo y no sobre la página. */
export type CatalogStatus =
  /** Página escrita y navegable. */
  | 'ready'
  /** Componente construido y en verde; falta su ficha en el showroom. */
  | 'built'
  /** Ficha escrita en el vault; el componente no está construido. */
  | 'documented'
  /** Lugar reservado, sin ficha ni código; visible para que no se olvide. */
  | 'gap';

export interface CatalogEntry {
  readonly id: string;
  /** Se muestra en la barra lateral y el índice, en español. */
  readonly name: string;
  /** Selector de Angular, para que la búsqueda encuentre lo que se escribe en una plantilla. */
  readonly selector: string | null;
  /** Ruta absoluta, o null si todavía no hay página. */
  readonly route: string | null;
  readonly status: CatalogStatus;
  /** Una línea sobre qué es, o por qué todavía no está. */
  readonly note: string;
}

export interface CatalogSection {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly CatalogEntry[];
}

/** Dónde monta el shell el showroom (app.routes.ts). */
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
    note: 'Catálogo cerrado de 71 iconos Tabler, con el trazo compensado por tamaño.',
  },
];

const COMPONENTS: readonly CatalogEntry[] = [
  {
    id: 'button',
    name: 'Botón',
    selector: 'ewms-button',
    route: `${SHOWROOM_BASE}/components/button`,
    status: 'ready',
    note: 'Cuatro variantes, tres tamaños, solo ícono cuadrado y el patrón anti-doble-envío.',
  },
  {
    id: 'text',
    name: 'Texto',
    selector: 'ewms-text',
    route: `${SHOWROOM_BASE}/components/text`,
    status: 'ready',
    note: 'Las siete variantes semánticas, y por qué el nivel visual no se separa del nivel del documento.',
  },
  {
    id: 'tooltip',
    name: 'Tooltip',
    selector: 'ewmsTooltip',
    route: `${SHOWROOM_BASE}/components/tooltip`,
    status: 'ready',
    note: 'Directiva, no componente. Las tres reglas de la 1.4.13 y la trampa del nombre disabled.',
  },
  {
    id: 'input',
    name: 'Input',
    selector: 'ewms-input',
    route: `${SHOWROOM_BASE}/components/input`,
    status: 'ready',
    note: 'Cinco tipos, ControlValueAccessor, y la altura compartida con el Botón del mismo tamaño.',
  },
  {
    id: 'checkbox',
    name: 'Checkbox',
    selector: 'ewms-checkbox',
    route: `${SHOWROOM_BASE}/components/checkbox`,
    status: 'ready',
    note: 'Caja de 18×18 con tercer estado indeterminado, para el «seleccionar todos».',
  },
  {
    id: 'radio',
    name: 'Radio',
    selector: 'ewms-radio',
    route: `${SHOWROOM_BASE}/components/radio`,
    status: 'ready',
    note: 'La misma caja que el Checkbox, agrupada por name nativo y sin tercer estado.',
  },
  {
    id: 'toggle',
    name: 'Toggle',
    selector: 'ewms-toggle',
    route: `${SHOWROOM_BASE}/components/toggle`,
    status: 'ready',
    note: 'Pista de 44×24 con pulgar de 20. Aplica al tocar: si hay un Guardar al lado, va Checkbox.',
  },
  {
    id: 'select',
    name: 'Select',
    selector: 'ewms-select',
    route: `${SHOWROOM_BASE}/components/select`,
    status: 'ready',
    note: 'El único selector: lista corta, lista larga que filtra y fuente remota que resuelve un escaneo.',
  },
  {
    id: 'table',
    name: 'Tabla de datos',
    selector: 'ewms-table',
    route: `${SHOWROOM_BASE}/components/table`,
    status: 'ready',
    note: 'Columnas declaradas, árbol aplanado, filtros por tipo y el teclado de un treegrid.',
  },
  {
    id: 'pagination',
    name: 'Paginación',
    selector: 'ewms-pagination',
    route: `${SHOWROOM_BASE}/components/pagination`,
    status: 'ready',
    note: 'Anterior, siguiente y dónde estás. Componente propio: la tabla es sólo su primer consumidor.',
  },
  {
    id: 'badge',
    name: 'Badge',
    selector: 'ewms-badge',
    route: `${SHOWROOM_BASE}/components/table`,
    status: 'ready',
    note: 'Icono y texto, siempre los dos. Nació en la Tabla y se usa fuera de ella.',
  },
  {
    id: 'modal',
    name: 'Modal / Dialog',
    selector: 'DialogService',
    route: `${SHOWROOM_BASE}/components/dialog`,
    status: 'ready',
    note: 'Confirmación como promesa y formulario como componente, sobre el dialog del CDK.',
  },
  {
    id: 'cards',
    name: 'Card',
    selector: 'ewms-card',
    route: `${SHOWROOM_BASE}/components/card`,
    status: 'ready',
    note: 'Dos usos bajo un nombre: opción dentro de un grupo, contenedor fuera de él. Lo decide el inyector.',
  },
  {
    id: 'banner',
    name: 'Banner',
    selector: 'ewms-banner',
    route: `${SHOWROOM_BASE}/components/banner`,
    status: 'ready',
    note: 'Mensaje en el flujo, cuatro severidades. Info se llama Info y se pinta neutral.',
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
    selector: 'ewms-nav-rail',
    route: `${SHOWROOM_BASE}/components/navigation`,
    status: 'ready',
    note: 'Rail, pestañas y migas, sincronizadas y sin router. La barra inferior, con su costo escrito.',
  },
  {
    id: 'favorites',
    name: 'Favoritos',
    selector: 'ewms-favorite-toggle',
    route: `${SHOWROOM_BASE}/components/navigation`,
    status: 'ready',
    note: 'La estrella y el bloque fijo del sidebar. En memoria hasta que exista el Security Core.',
  },
  {
    id: 'split-button',
    name: 'Split button',
    selector: 'ewms-split-button',
    route: `${SHOWROOM_BASE}/components/split-button`,
    status: 'ready',
    note: 'Acción principal y alternativas a un clic: «Descargar / PDF / Excel / CSV». El menú es el de la Tabla.',
  },
  {
    id: 'date-picker',
    name: 'Date picker',
    selector: 'ewms-date-picker',
    route: `${SHOWROOM_BASE}/components/date-picker`,
    status: 'ready',
    note: 'Fecha o período en el idioma de la app, escrita o elegida con el teclado. Valor ISO.',
  },
];

const PATTERNS: readonly CatalogEntry[] = [
  {
    id: 'pattern-keyboard',
    name: 'Atajos de teclado',
    selector: 'KeyboardShortcuts',
    route: `${SHOWROOM_BASE}/patterns/keyboard`,
    status: 'ready',
    note: 'Registro por acción, un solo listener, y la ráfaga de escáner que no dispara nada.',
  },
  {
    id: 'pattern-search-create-edit',
    name: 'Buscar, crear, editar',
    selector: null,
    route: `${SHOWROOM_BASE}/patterns/search-create-edit`,
    status: 'ready',
    note: 'La pantalla de ejemplo: el presupuesto de clics, medido en vivo sobre componentes que ya existían.',
  },
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

/** Etiqueta visible para una entrada sin página. */
export const STATUS_LABELS: Readonly<Record<CatalogStatus, string>> = {
  ready: '',
  built: '(pendiente)',
  documented: '(pendiente)',
  gap: '(pendiente)',
};

/**
 * Filtra por nombre y selector conservando las secciones, para que la barra no se reordene
 * al escribir. Las secciones vacías se quitan: un encabezado vacío parece una página rota.
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

/** Cantidad de entradas de un catálogo filtrado, para el conteo de resultados. */
export function countEntries(sections: readonly CatalogSection[]): number {
  return sections.reduce((total, section) => total + section.entries.length, 0);
}
