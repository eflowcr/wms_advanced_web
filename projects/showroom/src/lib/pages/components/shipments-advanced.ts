import type { Signal } from '@angular/core';
import { delay, Observable, of, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import type { MenuItem, TablePage, TableQuery, TableSource } from '@ewms/design-system';
import { ArrayTableSource } from '@ewms/design-system';
import { translated } from '../../ui/translated';
import type { ShipmentRow } from './shipments';
import { SHIPMENTS } from './shipments.fixtures';
import {
  FAILING_STATUS,
  generateLocations,
  NO_ANSWER,
  type LocationRow,
} from './table.fixtures';

/**
 * Fuentes del lote D, sintéticas y en memoria, sin HTTP: imitan el tiempo de una
 * fuente remota (hijo que tarda, hijo que falla) y el catálogo se ve sin red.
 */

/** Cuánto tarda en «llegar» un hijo perezoso. Suficiente para verlo. */
const CHILDREN_DELAY_MS = 900;

/** Solo cabeceras: la demo de detalle y menú enseña el panel, no la jerarquía. */
export const HEADER_ROWS: readonly ShipmentRow[] = SHIPMENTS.map(
  ({ children: _children, ...header }) => header,
);

/**
 * Anular, la destructiva, va última y separada: pegada a Duplicar se anula queriendo
 * copiar. Imprimir está deshabilitada para mostrar que queda visible y fuera de las flechas.
 * `label` es la clave de su texto.
 * t(showroom.table.actions.view, showroom.table.actions.printDeliveryNote,
 *   showroom.table.actions.duplicate, showroom.table.actions.cancel)
 */
const ROW_ACTIONS: readonly MenuItem[] = [
  { id: 'ver', label: 'showroom.table.actions.view', icon: 'eye' },
  {
    id: 'imprimir',
    label: 'showroom.table.actions.printDeliveryNote',
    icon: 'label-print',
    disabled: true,
  },
  { id: 'duplicar', label: 'showroom.table.actions.duplicate', icon: 'copy' },
  {
    id: 'anular',
    label: 'showroom.table.actions.cancel',
    icon: 'trash',
    variant: 'danger',
    separatorBefore: true,
  },
];

/**
 * Lo que se hace con varias a la vez: la barra de la tabla las muestra con la selección.
 * t(showroom.table.actions.printLabels, showroom.table.actions.cancel)
 */
const BULK_ACTIONS: readonly MenuItem[] = [
  { id: 'imprimir', label: 'showroom.table.actions.printLabels', icon: 'label-print' },
  { id: 'anular', label: 'showroom.table.actions.cancel', icon: 'trash', variant: 'danger' },
];

/** El menú de fila, con sus textos en el idioma activo: el menú no habla ninguno. */
export function injectRowActions(): Signal<readonly MenuItem[]> {
  return translated((translate) =>
    ROW_ACTIONS.map((item) => ({ ...item, label: translate(item.label) })),
  );
}

/** Las acciones masivas, igual. */
export function injectBulkActions(): Signal<readonly MenuItem[]> {
  return translated((translate) =>
    BULK_ACTIONS.map((item) => ({ ...item, label: translate(item.label) })),
  );
}

/**
 * Hijos con retraso; los de una cabecera con incidencia fallan siempre. La tabla
 * pinta «Cargando…» y «No se pudo cargar» con reintento sin que el consumidor escriba nada.
 */
export function lazyChildren(row: ShipmentRow): Observable<readonly ShipmentRow[]> {
  const original = SHIPMENTS.find((shipment) => shipment.id === row.id);
  const children = original?.children ?? [];

  if (row.status === FAILING_STATUS) {
    return timer(CHILDREN_DELAY_MS).pipe(
      map(() => {
        throw new Error(NO_ANSWER);
      }),
    );
  }

  return of(children).pipe(delay(CHILDREN_DELAY_MS));
}

/**
 * Filas iniciales: sesenta ya desplazan y muestran la ventana. Las cinco mil se
 * cargan con un botón para no hacer lenta la apertura de la ficha.
 */
export const SAMPLE_LOCATIONS = 60;

/** Tamaño a partir del cual la ventana virtual se vuelve necesaria. */
export const TOTAL_LOCATIONS = 5000;

/**
 * Pagina de verdad (página + total), así la tabla monta el paginador. Sin retraso:
 * los controles aparecerían tarde y el recorrido de tabulador del e2e fallaba.
 */
export class PagedSource implements TableSource<LocationRow> {
  private readonly base = new ArrayTableSource<LocationRow>(
    generateLocations(TOTAL_LOCATIONS),
    ['code', 'aisle'],
  );

  load(query: TableQuery): Observable<TablePage<LocationRow>> {
    return this.base.load(query);
  }
}
