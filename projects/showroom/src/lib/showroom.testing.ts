import { ApplicationInitStatus, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  EWMS_DATE_PICKER_MESSAGES,
  EWMS_FILTER_BAR_MESSAGES,
  EWMS_FILTER_CHIPS_MESSAGES,
  EWMS_FORM_MESSAGES,
  EWMS_PAGINATION_MESSAGES,
  EWMS_SEARCH_BOX_MESSAGES,
  EWMS_SELECT_MESSAGES,
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SPLIT_BUTTON_MESSAGES,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
  parseTableDate,
  type FormMessages,
  type TableMessages,
} from '@ewms/design-system';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
/* eslint-disable no-restricted-imports -- Solo pruebas: los diccionarios reales son del shell (public/i18n) y una clave que falta tiene que fallar acá. */
import en from '../../../shell/public/i18n/en.json';
import es from '../../../shell/public/i18n/es.json';
import showroomEn from '../../../shell/public/i18n/showroom/en.json';
import showroomEs from '../../../shell/public/i18n/showroom/es.json';
/* eslint-enable no-restricted-imports */
import { SHOWROOM_SCOPE } from './catalog';

/**
 * Soporte de las specs del catálogo, fuera del build (tsconfig.lib.json). Los diccionarios reales
 * para `provideI18nTesting`, y los textos del design system en español, que en la aplicación
 * provee el shell traducidos y acá no existe.
 */
export const SHOWROOM_DICTIONARIES = {
  es,
  en,
  [`${SHOWROOM_SCOPE}/es`]: showroomEs,
  [`${SHOWROOM_SCOPE}/en`]: showroomEn,
} as const;

/**
 * Arranque en español, como la aplicación con un navegador en español: sin esto jsdom dice
 * `en-US`. Se llama antes de configurar el `TestBed`, y después `loadShowroomScope()`.
 */
export function useSpanishBrowser(): void {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('es-CR');
}

/** Espera el diccionario raíz y carga el del catálogo, como hace la ruta antes de activarse. */
export async function loadShowroomScope(): Promise<void> {
  await TestBed.inject(ApplicationInitStatus).donePromise;
  const transloco = TestBed.inject(TranslocoService);
  await firstValueFrom(transloco.load(`${SHOWROOM_SCOPE}/${transloco.getActiveLang()}`));
}

/** Leer un texto del diccionario del catálogo por su clave, como lo haría el pipe. */
export function showroomText(key: string, lang: 'es' | 'en' = 'es'): string {
  const dictionary: unknown = lang === 'es' ? showroomEs : showroomEn;
  const value = key
    .replace(`${SHOWROOM_SCOPE}.`, '')
    .split('.')
    .reduce<unknown>((node, segment) => (node as Record<string, unknown>)?.[segment], dictionary);
  return typeof value === 'string' ? value : '';
}

const TABLE_MESSAGES: TableMessages = {
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
  filters: (active) => (active === 0 ? 'Filtros' : `Filtros (${active})`),
  clearFilters: 'Limpiar filtros',
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
  noResultsHint: 'Pruebe con otra búsqueda o limpie los filtros.',
  export: 'Exportar',
  exportSelected: 'CSV de lo seleccionado',
  copyAll: 'Copiar al portapapeles',
  rowsShown: (shown, total) => (total === null ? `${shown} filas` : `${shown} de ${total} filas`),
  aggregate: (kind, column, scope) => {
    const where = scope === 'selected' ? 'seleccionados' : 'en pantalla';
    if (kind === 'avg') {
      return `Promedio de ${column} ${where}`;
    }
    return kind === 'count' ? `Filas con ${column} ${where}` : `${column} ${where}`;
  },
};

const DAY = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit', year: 'numeric' });

const FORM_MESSAGES: FormMessages = {
  errors: {
    required: () => 'Este campo es obligatorio',
    minLength: (limit) => `Mínimo ${limit} caracteres`,
    maxLength: (limit) => `Máximo ${limit} caracteres`,
    min: (limit) => `El mínimo es ${limit}`,
    max: (limit) => `El máximo es ${limit}`,
    minDate: (limit) => `La fecha mínima es ${DAY.format(limit as Date)}`,
    maxDate: (limit) => `La fecha máxima es ${DAY.format(limit as Date)}`,
    pattern: () => 'El formato no es el esperado',
    email: () => 'Escriba un correo válido',
  },
  customError: () => 'Revise este campo',
  errorSummary: (count) => (count === 1 ? 'Revise 1 campo' : `Revise ${count} campos`),
  errorSummaryLabel: 'Error',
  requiredLegend: '* obligatorio',
};

/**
 * Los textos y formatos del design system en español, en lugar de los del shell. Mismos
 * tokens que provee `provideEwmsDesignSystem()`; sin ellos un botón de solo ícono sin nombre lanza.
 */
export function provideDesignSystemTextsTesting(): Provider[] {
  return [
    { provide: EWMS_TABLE_MESSAGES, useValue: TABLE_MESSAGES },
    {
      provide: EWMS_TABLE_FORMATTERS,
      useValue: {
        date: (value: unknown) => {
          const parsed = value === null || value === undefined ? null : parseTableDate(value);
          return parsed === null ? String(value ?? '') : DAY.format(parsed);
        },
        number: (value: unknown) =>
          value === null || value === undefined || value === ''
            ? ''
            : new Intl.NumberFormat('es').format(Number(value)),
      },
    },
    {
      provide: EWMS_SELECT_MESSAGES,
      useValue: {
        searching: 'Buscando…',
        noResults: (query: string) => `Sin resultados para «${query}»`,
        error: 'No se pudo consultar el catálogo.',
        retry: 'Reintentar',
        more: 'Ver más resultados',
        results: (count: number, total: number | null) =>
          total === null ? `${count} resultados` : `${count} de ${total} resultados`,
      },
    },
    {
      provide: EWMS_FILTER_BAR_MESSAGES,
      useValue: {
        moreFilters: (active: number) => (active === 0 ? 'Más filtros' : `Más filtros (${active})`),
        fewerFilters: 'Menos filtros',
      },
    },
    {
      provide: EWMS_FILTER_CHIPS_MESSAGES,
      useValue: {
        clearFilters: 'Limpiar filtros',
        removeFilter: (column: string) => `Quitar el filtro ${column}`,
      },
    },
    {
      provide: EWMS_PAGINATION_MESSAGES,
      useValue: {
        previousPage: 'Página anterior',
        nextPage: 'Página siguiente',
        pageOf: (page: number, pages: number) => `Página ${page} de ${pages}`,
        rowsTotal: (total: number) => (total === 1 ? '1 fila' : `${total} filas`),
      },
    },
    { provide: EWMS_FORM_MESSAGES, useValue: FORM_MESSAGES },
    {
      provide: EWMS_SHORTCUT_HELP_MESSAGES,
      useValue: {
        title: 'Atajos de teclado',
        intro:
          'Funcionan en toda la aplicación. Dentro de un campo de texto no se disparan, salvo Esc.',
        actionColumn: 'Acción',
        keyColumn: 'Tecla',
        close: 'Cerrar',
        singleKeyLabel: 'Atajos de una sola tecla',
        singleKeyHint: 'Los atajos de una sola tecla pueden dispararse solos.',
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
      },
    },
    { provide: EWMS_SPLIT_BUTTON_MESSAGES, useValue: { moreActions: 'Más opciones' } },
    {
      provide: EWMS_SEARCH_BOX_MESSAGES,
      useValue: { submit: 'Buscar', clear: 'Limpiar la búsqueda' },
    },
    {
      provide: EWMS_DATE_PICKER_MESSAGES,
      useValue: {
        chooseDate: 'Elegir fecha',
        previousMonth: 'Mes anterior',
        nextMonth: 'Mes siguiente',
        locale: 'es-CR',
      },
    },
  ];
}
