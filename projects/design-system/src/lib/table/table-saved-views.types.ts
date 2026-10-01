import { InjectionToken } from '@angular/core';
import type { TableFilterValue, TableSort } from './table-source';
import type { TableView } from './table.types';

/**
 * Lo que guarda una vista: columnas (orden, visibles, anchos, fijadas), densidad, filtros de
 * columna y orden. La búsqueda rápida no: es de un momento. Ver vault: Tabla §29.
 */
export interface TableSavedState {
  readonly view: TableView;
  readonly filters: Readonly<Record<string, TableFilterValue>>;
  readonly sort: readonly TableSort[];
}

export interface SavedTableView {
  readonly id: string;
  readonly name: string;
  readonly state: TableSavedState;
}

/** La versión del esquema: lo guardado con otra se descarta, nunca se interpreta a medias. */
export const TABLE_VIEWS_VERSION = 1;

/** Todo lo de una tabla para un usuario: sus vistas y cuál abre por defecto. */
export interface TableViewsDocument {
  readonly version: typeof TABLE_VIEWS_VERSION;
  readonly views: readonly SavedTableView[];
  readonly defaultId: string | null;
}

/**
 * Dónde viven las vistas, detrás de una interfaz: hoy el navegador (lo provee el shell), mañana el
 * servidor, sin tocar la tabla. Asíncrona aunque la de memoria conteste al instante. La clave es
 * la de la tabla (`viewsKey`); el usuario lo pone el store.
 */
export interface TableViewStore {
  read(tableKey: string): Promise<TableViewsDocument | null>;
  write(tableKey: string, document: TableViewsDocument): Promise<void>;
}

/** Provisto una vez por aplicación; sin él, la tabla no ofrece vistas guardadas. */
export const EWMS_TABLE_VIEW_STORE = new InjectionToken<TableViewStore>('EWMS_TABLE_VIEW_STORE');

/** En memoria: las pruebas y quien no quiere recordar nada entre recargas. */
export class InMemoryTableViewStore implements TableViewStore {
  private readonly documents = new Map<string, TableViewsDocument>();

  read(tableKey: string): Promise<TableViewsDocument | null> {
    return Promise.resolve(this.documents.get(tableKey) ?? null);
  }

  write(tableKey: string, document: TableViewsDocument): Promise<void> {
    this.documents.set(tableKey, document);
    return Promise.resolve();
  }
}

/**
 * Lo leído de un almacenamiento, validado: otra versión, otra forma o un tipo equivocado dan
 * `null` y el llamador lo descarta. Una vista mal formada cae sola; las demás se conservan.
 */
export function parseTableViews(raw: unknown): TableViewsDocument | null {
  if (!isRecord(raw) || raw['version'] !== TABLE_VIEWS_VERSION || !Array.isArray(raw['views'])) {
    return null;
  }
  const views = raw['views'].filter(isSavedView);
  const defaultId = typeof raw['defaultId'] === 'string' ? raw['defaultId'] : null;
  return {
    version: TABLE_VIEWS_VERSION,
    views,
    defaultId: views.some((view) => view.id === defaultId) ? defaultId : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isStrings = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Las cuatro formas de `TableFilterValue`: texto, rango numérico, rango de fechas y conjunto. */
function isFilterValue(value: unknown): boolean {
  if (typeof value === 'string' || isStrings(value)) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  const bounds = Object.entries(value);
  const numbers = bounds.every(([key, bound]) => ['min', 'max'].includes(key) && typeof bound === 'number');
  const dates = bounds.every(([key, bound]) => ['from', 'to'].includes(key) && typeof bound === 'string');
  return bounds.length > 0 && (numbers || dates);
}

function isSavedView(value: unknown): value is SavedTableView {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string') {
    return false;
  }
  const state = value['state'];
  if (!isRecord(state) || !isRecord(state['view']) || !isRecord(state['filters'])) {
    return false;
  }
  const view = state['view'];
  const sort = state['sort'];
  return (
    Object.values(state['filters']).every(isFilterValue) &&
    isStrings(view['order']) &&
    isStrings(view['hidden']) &&
    isRecord(view['widths']) &&
    Object.values(view['widths']).every((width) => typeof width === 'number') &&
    isRecord(view['pinned']) &&
    Object.values(view['pinned']).every((pin) => pin === 'start' || pin === 'end') &&
    (view['density'] === 'md' || view['density'] === 'sm') &&
    Array.isArray(sort) &&
    sort.every(
      (item) =>
        isRecord(item) &&
        typeof item['key'] === 'string' &&
        (item['direction'] === 'asc' || item['direction'] === 'desc'),
    )
  );
}
