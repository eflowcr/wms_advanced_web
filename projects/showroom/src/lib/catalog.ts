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
  /** Clave del nombre que se muestra en la barra lateral, el índice y la pestaña. */
  readonly name: string;
  /**
   * Lo que se escribe en una plantilla o se inyecta, uno por nombre público de la página: la búsqueda
   * encuentra la página por cualquiera (tools/ci/catalog.test.mjs cruza public-api.ts).
   */
  readonly selectors: readonly string[];
  /** Ruta absoluta, o null si todavía no hay página. */
  readonly route: string | null;
  readonly status: CatalogStatus;
  /** Clave de una línea sobre qué es, o por qué todavía no está. */
  readonly note: string;
}

export interface CatalogSection {
  readonly id: string;
  /** Clave del encabezado de la sección. */
  readonly title: string;
  readonly entries: readonly CatalogEntry[];
}

/** Dónde monta el shell el showroom (app.routes.ts). */
export const SHOWROOM_BASE = '/design-system';

/** El scope de Transloco del catálogo: `public/i18n/showroom/<lang>.json`, perezoso. */
export const SHOWROOM_SCOPE = 'showroom';

/**
 * Claves literales; el marcador es lo que ve transloco-keys-manager.
 * t(showroom.catalog.sections.foundations, showroom.catalog.sections.components, showroom.catalog.sections.patterns, showroom.catalog.pending, showroom.catalog.brand.name, showroom.catalog.brand.note, showroom.catalog.colors.name, showroom.catalog.colors.note, showroom.catalog.typography.name, showroom.catalog.typography.note, showroom.catalog.spacing.name, showroom.catalog.spacing.note, showroom.catalog.icons.name, showroom.catalog.icons.note, showroom.catalog.button.name, showroom.catalog.button.note, showroom.catalog.text.name, showroom.catalog.text.note, showroom.catalog.tooltip.name, showroom.catalog.tooltip.note, showroom.catalog.input.name, showroom.catalog.input.note, showroom.catalog.searchBox.name, showroom.catalog.searchBox.note, showroom.catalog.checkbox.name, showroom.catalog.checkbox.note, showroom.catalog.radio.name, showroom.catalog.radio.note, showroom.catalog.toggle.name, showroom.catalog.toggle.note, showroom.catalog.select.name, showroom.catalog.select.note, showroom.catalog.table.name, showroom.catalog.table.note, showroom.catalog.pagination.name, showroom.catalog.pagination.note, showroom.catalog.badge.name, showroom.catalog.badge.note, showroom.catalog.modal.name, showroom.catalog.modal.note, showroom.catalog.cards.name, showroom.catalog.cards.note, showroom.catalog.banner.name, showroom.catalog.banner.note, showroom.catalog.toast.name, showroom.catalog.toast.note, showroom.catalog.navigation.name, showroom.catalog.navigation.note, showroom.catalog.favorites.name, showroom.catalog.favorites.note, showroom.catalog.splitButton.name, showroom.catalog.splitButton.note, showroom.catalog.datePicker.name, showroom.catalog.datePicker.note, showroom.catalog.patternKeyboard.name, showroom.catalog.patternKeyboard.note, showroom.catalog.patternSearchCreateEdit.name, showroom.catalog.patternSearchCreateEdit.note, showroom.catalog.patternForm.name, showroom.catalog.patternForm.note, showroom.catalog.patternFilters.name, showroom.catalog.patternFilters.note, showroom.catalog.patternEmpty.name, showroom.catalog.patternEmpty.note)
 */
const FOUNDATIONS: readonly CatalogEntry[] = [
  {
    id: 'brand',
    name: 'showroom.catalog.brand.name',
    selectors: [],
    route: `${SHOWROOM_BASE}/foundations/brand`,
    status: 'ready',
    note: 'showroom.catalog.brand.note',
  },
  {
    id: 'colors',
    name: 'showroom.catalog.colors.name',
    selectors: [],
    route: `${SHOWROOM_BASE}/foundations/colors`,
    status: 'ready',
    note: 'showroom.catalog.colors.note',
  },
  {
    id: 'typography',
    name: 'showroom.catalog.typography.name',
    selectors: [],
    route: `${SHOWROOM_BASE}/foundations/typography`,
    status: 'ready',
    note: 'showroom.catalog.typography.note',
  },
  {
    id: 'spacing',
    name: 'showroom.catalog.spacing.name',
    selectors: [],
    route: `${SHOWROOM_BASE}/foundations/spacing`,
    status: 'ready',
    note: 'showroom.catalog.spacing.note',
  },
  {
    id: 'icons',
    name: 'showroom.catalog.icons.name',
    selectors: ['ewms-icon'],
    route: `${SHOWROOM_BASE}/foundations/icons`,
    status: 'ready',
    note: 'showroom.catalog.icons.note',
  },
];

const COMPONENTS: readonly CatalogEntry[] = [
  {
    id: 'button',
    name: 'showroom.catalog.button.name',
    selectors: ['ewms-button'],
    route: `${SHOWROOM_BASE}/components/button`,
    status: 'ready',
    note: 'showroom.catalog.button.note',
  },
  {
    id: 'text',
    name: 'showroom.catalog.text.name',
    selectors: ['ewms-text'],
    route: `${SHOWROOM_BASE}/components/text`,
    status: 'ready',
    note: 'showroom.catalog.text.note',
  },
  {
    id: 'tooltip',
    name: 'showroom.catalog.tooltip.name',
    selectors: ['ewmsTooltip'],
    route: `${SHOWROOM_BASE}/components/tooltip`,
    status: 'ready',
    note: 'showroom.catalog.tooltip.note',
  },
  {
    id: 'input',
    name: 'showroom.catalog.input.name',
    selectors: ['ewms-input'],
    route: `${SHOWROOM_BASE}/components/input`,
    status: 'ready',
    note: 'showroom.catalog.input.note',
  },
  {
    id: 'search-box',
    name: 'showroom.catalog.searchBox.name',
    selectors: ['ewms-search-box'],
    route: `${SHOWROOM_BASE}/components/search-box`,
    status: 'ready',
    note: 'showroom.catalog.searchBox.note',
  },
  {
    id: 'checkbox',
    name: 'showroom.catalog.checkbox.name',
    selectors: ['ewms-checkbox'],
    route: `${SHOWROOM_BASE}/components/checkbox`,
    status: 'ready',
    note: 'showroom.catalog.checkbox.note',
  },
  {
    id: 'radio',
    name: 'showroom.catalog.radio.name',
    selectors: ['ewms-radio', 'ewms-radio-group'],
    route: `${SHOWROOM_BASE}/components/radio`,
    status: 'ready',
    note: 'showroom.catalog.radio.note',
  },
  {
    id: 'toggle',
    name: 'showroom.catalog.toggle.name',
    selectors: ['ewms-toggle'],
    route: `${SHOWROOM_BASE}/components/toggle`,
    status: 'ready',
    note: 'showroom.catalog.toggle.note',
  },
  {
    id: 'select',
    name: 'showroom.catalog.select.name',
    selectors: ['ewms-select'],
    route: `${SHOWROOM_BASE}/components/select`,
    status: 'ready',
    note: 'showroom.catalog.select.note',
  },
  {
    id: 'table',
    name: 'showroom.catalog.table.name',
    selectors: ['ewms-table', 'ewms-column', 'ewmsCell', 'ewmsDetail', 'ewmsEmpty'],
    route: `${SHOWROOM_BASE}/components/table`,
    status: 'ready',
    note: 'showroom.catalog.table.note',
  },
  {
    id: 'pagination',
    name: 'showroom.catalog.pagination.name',
    selectors: ['ewms-pagination'],
    route: `${SHOWROOM_BASE}/components/pagination`,
    status: 'ready',
    note: 'showroom.catalog.pagination.note',
  },
  {
    id: 'badge',
    name: 'showroom.catalog.badge.name',
    selectors: ['ewms-badge'],
    route: `${SHOWROOM_BASE}/components/table`,
    status: 'ready',
    note: 'showroom.catalog.badge.note',
  },
  {
    id: 'modal',
    name: 'showroom.catalog.modal.name',
    selectors: ['DialogService'],
    route: `${SHOWROOM_BASE}/components/dialog`,
    status: 'ready',
    note: 'showroom.catalog.modal.note',
  },
  {
    id: 'cards',
    name: 'showroom.catalog.cards.name',
    selectors: ['ewms-card', 'ewms-card-group'],
    route: `${SHOWROOM_BASE}/components/card`,
    status: 'ready',
    note: 'showroom.catalog.cards.note',
  },
  {
    id: 'banner',
    name: 'showroom.catalog.banner.name',
    selectors: ['ewms-banner'],
    route: `${SHOWROOM_BASE}/components/banner`,
    status: 'ready',
    note: 'showroom.catalog.banner.note',
  },
  {
    id: 'toast',
    name: 'showroom.catalog.toast.name',
    selectors: ['ewms-toast-outlet', 'ToastService'],
    route: `${SHOWROOM_BASE}/components/toast`,
    status: 'ready',
    note: 'showroom.catalog.toast.note',
  },
  {
    id: 'navigation',
    name: 'showroom.catalog.navigation.name',
    selectors: ['ewms-nav-rail', 'ewms-nav-bottom', 'ewms-tabs', 'ewms-breadcrumbs'],
    route: `${SHOWROOM_BASE}/components/navigation`,
    status: 'ready',
    note: 'showroom.catalog.navigation.note',
  },
  {
    id: 'favorites',
    name: 'showroom.catalog.favorites.name',
    selectors: ['ewms-favorite-toggle', 'ewms-favorites-nav'],
    route: `${SHOWROOM_BASE}/components/navigation`,
    status: 'ready',
    note: 'showroom.catalog.favorites.note',
  },
  {
    id: 'split-button',
    name: 'showroom.catalog.splitButton.name',
    selectors: ['ewms-split-button'],
    route: `${SHOWROOM_BASE}/components/split-button`,
    status: 'ready',
    note: 'showroom.catalog.splitButton.note',
  },
  {
    id: 'date-picker',
    name: 'showroom.catalog.datePicker.name',
    selectors: ['ewms-date-picker'],
    route: `${SHOWROOM_BASE}/components/date-picker`,
    status: 'ready',
    note: 'showroom.catalog.datePicker.note',
  },
];

const PATTERNS: readonly CatalogEntry[] = [
  {
    id: 'pattern-keyboard',
    name: 'showroom.catalog.patternKeyboard.name',
    selectors: ['KeyboardShortcuts', 'ewmsShortcutsHost'],
    route: `${SHOWROOM_BASE}/patterns/keyboard`,
    status: 'ready',
    note: 'showroom.catalog.patternKeyboard.note',
  },
  {
    id: 'pattern-search-create-edit',
    name: 'showroom.catalog.patternSearchCreateEdit.name',
    selectors: [],
    route: `${SHOWROOM_BASE}/patterns/search-create-edit`,
    status: 'ready',
    note: 'showroom.catalog.patternSearchCreateEdit.note',
  },
  {
    id: 'pattern-form',
    name: 'showroom.catalog.patternForm.name',
    selectors: ['ewmsForm'],
    route: `${SHOWROOM_BASE}/patterns/form`,
    status: 'ready',
    note: 'showroom.catalog.patternForm.note',
  },
  {
    id: 'pattern-filters',
    name: 'showroom.catalog.patternFilters.name',
    selectors: ['ewms-filter-bar'],
    route: `${SHOWROOM_BASE}/patterns/filters`,
    status: 'ready',
    note: 'showroom.catalog.patternFilters.note',
  },
  {
    id: 'pattern-empty',
    name: 'showroom.catalog.patternEmpty.name',
    selectors: ['ewms-empty-state'],
    route: `${SHOWROOM_BASE}/patterns/empty-state`,
    status: 'ready',
    note: 'showroom.catalog.patternEmpty.note',
  },
];

export const CATALOG: readonly CatalogSection[] = [
  { id: 'foundations', title: 'showroom.catalog.sections.foundations', entries: FOUNDATIONS },
  { id: 'components', title: 'showroom.catalog.sections.components', entries: COMPONENTS },
  { id: 'patterns', title: 'showroom.catalog.sections.patterns', entries: PATTERNS },
];

/** Clave de la etiqueta de una entrada sin página; una lista no lleva etiqueta. */
export const STATUS_LABELS: Readonly<Record<CatalogStatus, string | null>> = {
  ready: null,
  built: 'showroom.catalog.pending',
  documented: 'showroom.catalog.pending',
  gap: 'showroom.catalog.pending',
};

/**
 * Filtra por el nombre en el idioma activo (`nameOf` traduce la clave) y por el selector,
 * conservando las secciones para que la barra no se reordene al escribir. Las secciones vacías se
 * quitan: un encabezado vacío parece una página rota.
 */
export function filterCatalog(
  query: string,
  nameOf: (entry: CatalogEntry) => string,
): readonly CatalogSection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return CATALOG;
  }
  return CATALOG.map((section) => ({
    ...section,
    entries: section.entries.filter(
      (entry) =>
        nameOf(entry).toLowerCase().includes(needle) ||
        entry.selectors.some((selector) => selector.toLowerCase().includes(needle)),
    ),
  })).filter((section) => section.entries.length > 0);
}

/** Cantidad de entradas de un catálogo filtrado, para el conteo de resultados. */
export function countEntries(sections: readonly CatalogSection[]): number {
  return sections.reduce((total, section) => total + section.entries.length, 0);
}

/** La primera entrada con esa ruta: Badge y Favoritos comparten la de Tabla y Navegación. */
export function catalogEntryFor(route: string): CatalogEntry | null {
  const path = route.split(/[?#]/)[0];
  return CATALOG.flatMap((section) => section.entries).find((entry) => entry.route === path) ?? null;
}

/**
 * La clave del nombre de una página por su ruta, para quien la nombra desde afuera (el favorito
 * del riel, la pestaña). Fuera del catálogo devuelve null, y la portada del showroom también: esa
 * la nombra el menú.
 */
export function catalogKeyFor(route: string): string | null {
  return catalogEntryFor(route)?.name ?? null;
}
