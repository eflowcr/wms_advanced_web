import { inject, signal, type Provider } from '@angular/core';
import {
  EWMS_DATE_PICKER_MESSAGES,
  EWMS_FILTER_BAR_MESSAGES,
  EWMS_FORM_MESSAGES,
  EWMS_FAVORITE_LABELS,
  EWMS_SELECT_MESSAGES,
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SPLIT_BUTTON_MESSAGES,
  EWMS_SHORTCUT_MAP,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  parseTableDate,
  type FavoriteLabelResolver,
  type FilterBarMessages,
  type FormMessages,
  type SelectMessages,
  type ShortcutHelpMessages,
  type TableFormatters,
  type TableMessages,
} from '@ewms/design-system';
import { CATALOG } from './catalog';
import { SHOWROOM_SHORTCUT_MAP } from './shortcuts.map';

/**
 * Lo que el shell provee desde `core/i18n`, en versión propia del showroom: solo español, exento
 * de i18n (compuerta 12) y sin acceso a `@ewms/core` (frontera en eslint.config.js).
 */
export function provideShowroomDesignSystem(): Provider[] {
  return [
    { provide: EWMS_TABLE_MESSAGES, useValue: TABLE_MESSAGES },
    { provide: EWMS_TABLE_FORMATTERS, useValue: TABLE_FORMATTERS },
    { provide: EWMS_SELECT_MESSAGES, useValue: SELECT_MESSAGES },
    { provide: EWMS_FILTER_BAR_MESSAGES, useValue: FILTER_BAR_MESSAGES },
    { provide: EWMS_FORM_MESSAGES, useValue: FORM_MESSAGES },
    { provide: EWMS_SHORTCUT_MAP, useValue: SHOWROOM_SHORTCUT_MAP },
    { provide: EWMS_SHORTCUT_HELP_MESSAGES, useValue: SHORTCUT_HELP_MESSAGES },
    { provide: EWMS_SPLIT_BUTTON_MESSAGES, useValue: { moreActions: 'Más opciones' } },
    {
      provide: EWMS_DATE_PICKER_MESSAGES,
      useValue: {
        chooseDate: 'Elegir fecha',
        previousMonth: 'Mes anterior',
        nextMonth: 'Mes siguiente',
        locale: 'es-CR',
      },
    },

    // Nombres de rutas, no el almacén: `EWMS_FAVORITES_STORE` y `Favorites` vienen de la aplicación.
    // Proveerlos otra vez dio una página con dos estrellas y dos listas en desacuerdo.
    // Las palabras se pueden proveer dos veces; el estado, no.
    { provide: EWMS_FAVORITE_LABELS, useFactory: favoriteLabels },
  ];
}

// Nombre de un favorito en la barra del catálogo: el de su entrada en `catalog.ts`; si no es del
// catálogo, se le pregunta al resolvedor de arriba (`skipSelf`). Sin nadie arriba no resuelve
// nada y el bloque muestra la ruta, como promete la librería.
function favoriteLabels(): FavoriteLabelResolver {
  const parent = inject(EWMS_FAVORITE_LABELS, { skipSelf: true, optional: true });
  const entries = CATALOG.flatMap((section) => section.entries);
  const nameOf = (route: string) => entries.find((entry) => entry.route === route)?.name;
  return {
    labelFor: (route) => {
      const name = nameOf(route);
      return name === undefined
        ? (parent?.labelFor(route) ?? signal('').asReadonly())
        : signal(name).asReadonly();
    },
    iconFor: (route) => (nameOf(route) === undefined ? (parent?.iconFor(route) ?? null) : null),
  };
}

/**
 * Literales y no getters (el shell los usa porque cambia de idioma; acá no hay idioma que cambiar).
 * La lista de atajos sale de `SHOWROOM_SHORTCUT_MAP`; esto da una etiqueta por acción.
 */
export const SHORTCUT_HELP_MESSAGES: ShortcutHelpMessages = {
  title: 'Atajos de teclado',
  intro: 'Funcionan en todo el showroom. Dentro de un campo de texto no se disparan, salvo Esc.',
  actionColumn: 'Acción',
  keyColumn: 'Tecla',
  close: 'Cerrar',
  singleKeyLabel: 'Atajos de una sola tecla',
  singleKeyHint:
    'Los atajos de una sola tecla pueden dispararse solos con entrada por voz o con un pulsador. ' +
    'Apagarlos no afecta a los que llevan Alt o Ctrl. La preferencia dura lo que dure esta pestaña.',
  singleKeyOff: '(apagado)',
  actions: {
    search: 'Llevar el foco al campo de búsqueda',
    create: 'Crear un registro nuevo',
    save: 'Guardar el formulario activo',
    cancel: 'Cancelar lo que esté en curso, o cerrar lo que esté abierto',
    filters: 'Mostrar u ocultar los filtros de la tabla',
    moveColumnLeft: 'Mover la columna enfocada a la izquierda',
    moveColumnRight: 'Mover la columna enfocada a la derecha',
    help: 'Abrir esta lista',
  },
};

export const TABLE_MESSAGES: TableMessages = {
  search: 'Buscar en la tabla',
  filterPlaceholder: 'Filtrar',
  filterFrom: 'Desde',
  filterTo: 'Hasta',
  selectAll: 'Seleccionar todas las filas visibles',
  selectRow: 'Seleccionar la fila',
  expand: 'Expandir la fila',
  collapse: 'Contraer la fila',
  rowMenu: 'Acciones de la fila',
  loadingChildren: 'Cargando las líneas…',
  childrenFailed: 'No se pudieron cargar las líneas.',
  retry: 'Reintentar',
  sortedAscending: 'Orden ascendente',
  sortedDescending: 'Orden descendente',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageOf: (page, pages) => `Página ${page} de ${pages}`,
  rowsTotal: (total) => (total === 1 ? '1 fila' : `${total} filas`),
  filters: (active) => (active === 0 ? 'Filtros' : `Filtros (${active})`),
  clearFilters: 'Limpiar filtros',
  removeFilter: (column) => `Quitar el filtro ${column}`,
  view: 'Vista',
  resetView: 'Restablecer vista',
  expandAll: 'Expandir todo',
  collapseAll: 'Contraer todo',
  density: 'Densidad',
  densityMd: 'Media',
  densitySm: 'Compacta',
  setAll: 'Todos',
  setNone: 'Ninguno',
  setSummary: (column, chosen, total) => {
    if (chosen === total) {
      return `${column}: todos`;
    }
    return chosen === 0 ? `${column}: ninguno` : `${column}: ${chosen} de ${total}`;
  },
  columns: 'Columnas',
  resizeColumn: (column) => `Ancho de la columna ${column}`,
  moveEarlier: (column) => `Subir ${column}`,
  moveLater: (column) => `Bajar ${column}`,
  columnMoved: (column, position, total) => `${column}, posición ${position} de ${total}`,
  columnMenu: (column) => `Opciones de la columna ${column}`,
  columnActions: {
    sortAsc: 'Ordenar ascendente',
    sortDesc: 'Ordenar descendente',
    sortClear: 'Quitar orden',
    pinStart: 'Fijar a la izquierda',
    pinEnd: 'Fijar a la derecha',
    unpin: 'Soltar',
    fit: 'Ajustar al contenido',
    moveLeft: 'Mover a la izquierda',
    moveRight: 'Mover a la derecha',
    hide: 'Ocultar columna',
  },
  sortPriority: (sorted, priority) => `${sorted}, prioridad ${priority}`,
  selectedCount: (count) => (count === 1 ? '1 seleccionada' : `${count} seleccionadas`),
  clearSelection: 'Quitar selección',
  copied: (rows) => (rows === 1 ? '1 fila copiada' : `${rows} filas copiadas`),
  loading: 'Cargando…',
  loadFailed: 'No se pudieron cargar las filas.',
  noData: 'Todavía no hay filas.',
  noResults: 'Ninguna fila coincide.',
  noResultsHint: 'Probá con otra búsqueda o limpiá los filtros.',
  export: 'Exportar',
  exportSelected: 'CSV de lo seleccionado',
  copyAll: 'Copiar al portapapeles',
  rowsShown: (shown, total) =>
    total === null ? `${shown} filas` : `${shown} de ${total} filas`,
  aggregate: (kind, column, scope) => {
    const where = scope === 'selected' ? 'seleccionados' : 'en pantalla';
    if (kind === 'avg') {
      return `Promedio de ${column.toLowerCase()} ${where}`;
    }
    return kind === 'count' ? `Filas con ${column.toLowerCase()} ${where}` : `${column} ${where}`;
  },
};

/** Los límites de fecha se leen como los de la tabla: 16/03/2026. */
const DATE_LIMIT_FORMAT = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATE_FORMAT = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** `Intl` directo y no `transloco-locale`: la tabla solo pide dos funciones que devuelvan texto. */
export const TABLE_FORMATTERS: TableFormatters = {
  // `parseTableDate` y no `new Date(...)`: `new Date('2026-03-15')` es medianoche UTC e imprimía
  // el 14 al oeste de UTC. El shell tenía el mismo bug; el parseo compartido evita arreglar uno solo.
  date: (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const parsed = parseTableDate(value);
    // Día y mes con dos dígitos: en columna, 16/03/2026 y 5/02/2026 se leen desalineados.
    return parsed === null ? String(value) : DATE_FORMAT.format(parsed);
  },
  number: (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? new Intl.NumberFormat('es').format(parsed) : String(value);
  },
};

/** Un mensaje por `kind`: el campo muestra el del validador que falló, en lugar de su hint. */
export const FORM_MESSAGES: FormMessages = {
  errors: {
    required: () => 'Este campo es obligatorio',
    minLength: (limit) => `Mínimo ${limit} caracteres`,
    maxLength: (limit) => `Máximo ${limit} caracteres`,
    min: (limit) => `El mínimo es ${limit}`,
    max: (limit) => `El máximo es ${limit}`,
    minDate: (limit) => `La fecha mínima es ${DATE_LIMIT_FORMAT.format(limit as Date)}`,
    maxDate: (limit) => `La fecha máxima es ${DATE_LIMIT_FORMAT.format(limit as Date)}`,
    pattern: () => 'El formato no es el esperado',
    email: () => 'Escribí un correo válido',
  },
  customError: () => 'Revisá este campo',
  errorSummary: (count) => (count === 1 ? 'Revisá 1 campo' : `Revisá ${count} campos`),
  errorSummaryLabel: 'Error',
  requiredLegend: '* obligatorio',
};

/** Los chips comparten `clearFilters` y `removeFilter` con la tabla: una sola forma de decirlo. */
export const FILTER_BAR_MESSAGES: FilterBarMessages = {
  moreFilters: (active) => (active === 0 ? 'Más filtros' : `Más filtros (${active})`),
  fewerFilters: 'Menos filtros',
  clearFilters: 'Limpiar filtros',
  removeFilter: (field) => `Quitar el filtro ${field}`,
};

export const SELECT_MESSAGES: SelectMessages = {
  searching: 'Buscando…',
  noResults: (query) => `Sin resultados para «${query}»`,
  error: 'No se pudo consultar el catálogo.',
  retry: 'Reintentar',
  more: 'Ver más resultados',
  results: (count, total) =>
    total === null ? `${count} resultados` : `${count} de ${total} resultados`,
};
