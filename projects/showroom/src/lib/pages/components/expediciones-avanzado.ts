import type { Signal } from '@angular/core';
import { delay, Observable, of, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import type { MenuItem, TablePage, TableQuery, TableSource } from '@ewms/design-system';
import { ArrayTableSource } from '@ewms/design-system';
import { translated } from '../../ui/translated';
import type { ExpedicionRow } from './expediciones';
import { EXPEDICIONES } from './expediciones.fixtures';
import {
  ESTADO_QUE_FALLA,
  generarUbicaciones,
  SIN_RESPUESTA,
  type UbicacionRow,
} from './table.fixtures';

/**
 * Fuentes del lote D, sintéticas y en memoria, sin HTTP: imitan el tiempo de una
 * fuente remota (hijo que tarda, hijo que falla) y el catálogo se ve sin red.
 */

/** Cuánto tarda en «llegar» un hijo perezoso. Suficiente para verlo. */
const RETRASO_HIJOS = 900;

/** Solo cabeceras: la demo de detalle y menú enseña el panel, no la jerarquía. */
export const CABECERAS: readonly ExpedicionRow[] = EXPEDICIONES.map(
  ({ hijos: _sinHijos, ...cabecera }) => cabecera,
);

/**
 * Anular, la destructiva, va última y separada: pegada a Duplicar se anula queriendo
 * copiar. Imprimir está deshabilitada para mostrar que queda visible y fuera de las flechas.
 * `label` es la clave de su texto.
 * t(showroom.table.actions.view, showroom.table.actions.printDeliveryNote,
 *   showroom.table.actions.duplicate, showroom.table.actions.cancel)
 */
const ACCIONES_FILA: readonly MenuItem[] = [
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
    tone: 'danger',
    separatorBefore: true,
  },
];

/**
 * Lo que se hace con varias a la vez: la barra de la tabla las muestra con la selección.
 * t(showroom.table.actions.printLabels, showroom.table.actions.cancel)
 */
const ACCIONES_MASIVAS: readonly MenuItem[] = [
  { id: 'imprimir', label: 'showroom.table.actions.printLabels', icon: 'label-print' },
  { id: 'anular', label: 'showroom.table.actions.cancel', icon: 'trash', tone: 'danger' },
];

/** El menú de fila, con sus textos en el idioma activo: el menú no habla ninguno. */
export function injectAccionesFila(): Signal<readonly MenuItem[]> {
  return translated((translate) =>
    ACCIONES_FILA.map((item) => ({ ...item, label: translate(item.label) })),
  );
}

/** Las acciones masivas, igual. */
export function injectAccionesMasivas(): Signal<readonly MenuItem[]> {
  return translated((translate) =>
    ACCIONES_MASIVAS.map((item) => ({ ...item, label: translate(item.label) })),
  );
}

/**
 * Hijos con retraso; los de una cabecera con incidencia fallan siempre. La tabla
 * pinta «Cargando…» y «No se pudo cargar» con reintento sin que el consumidor escriba nada.
 */
export function hijosPerezosos(row: ExpedicionRow): Observable<readonly ExpedicionRow[]> {
  const original = EXPEDICIONES.find((expedicion) => expedicion.id === row.id);
  const hijos = original?.hijos ?? [];

  if (row.estado === ESTADO_QUE_FALLA) {
    return timer(RETRASO_HIJOS).pipe(
      map(() => {
        throw new Error(SIN_RESPUESTA);
      }),
    );
  }

  return of(hijos).pipe(delay(RETRASO_HIJOS));
}

/**
 * Filas iniciales: sesenta ya desplazan y muestran la ventana. Las cinco mil se
 * cargan con un botón para no hacer lenta la apertura de la ficha.
 */
export const UBICACIONES_MUESTRA = 60;

/** Tamaño a partir del cual la ventana virtual se vuelve necesaria. */
export const UBICACIONES_TOTAL = 5000;

/**
 * Pagina de verdad (página + total), así la tabla monta el paginador. Sin retraso:
 * los controles aparecerían tarde y el recorrido de tabulador del e2e fallaba.
 */
export class FuentePaginada implements TableSource<UbicacionRow> {
  private readonly base = new ArrayTableSource<UbicacionRow>(
    generarUbicaciones(UBICACIONES_TOTAL),
    ['codigo', 'pasillo'],
  );

  load(query: TableQuery): Observable<TablePage<UbicacionRow>> {
    return this.base.load(query);
  }
}
