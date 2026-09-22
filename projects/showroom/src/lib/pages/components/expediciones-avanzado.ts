import { delay, Observable, of, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import type { MenuItem, TablePage, TableQuery, TableSource } from '@ewms/design-system';
import { ArrayTableSource } from '@ewms/design-system';
import { EXPEDICIONES, type ExpedicionRow } from './expediciones';

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
 */
export const ACCIONES_FILA: readonly MenuItem[] = [
  { id: 'ver', label: 'Ver detalle', icon: 'eye' },
  { id: 'imprimir', label: 'Imprimir albarán', icon: 'label-print', disabled: true },
  { id: 'duplicar', label: 'Duplicar', icon: 'copy' },
  { id: 'anular', label: 'Anular', icon: 'trash', tone: 'danger', separatorBefore: true },
];

/** Lo que se hace con varias a la vez: la barra de la tabla las muestra con la selección. */
export const ACCIONES_MASIVAS: readonly MenuItem[] = [
  { id: 'imprimir', label: 'Imprimir etiquetas', icon: 'label-print' },
  { id: 'anular', label: 'Anular', icon: 'trash', tone: 'danger' },
];

/**
 * Hijos con retraso; los de una cabecera con incidencia fallan siempre. La tabla
 * pinta «Cargando…» y «No se pudo cargar» con reintento sin que el consumidor escriba nada.
 */
export function hijosPerezosos(row: ExpedicionRow): Observable<readonly ExpedicionRow[]> {
  const original = EXPEDICIONES.find((expedicion) => expedicion.id === row.id);
  const hijos = original?.hijos ?? [];

  if (row.estado === 'con-incidencia') {
    return timer(RETRASO_HIJOS).pipe(
      map(() => {
        throw new Error('sin respuesta');
      }),
    );
  }

  return of(hijos).pipe(delay(RETRASO_HIJOS));
}

/** Una fila de la tabla grande. Dos columnas: lo justo para que se note la altura. */
export interface UbicacionRow {
  readonly id: number;
  readonly codigo: string;
  readonly pasillo: string;
  readonly ocupacion: number;
}

const PASILLOS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Ubicaciones generadas, no traídas. */
export function generarUbicaciones(cuantas: number): readonly UbicacionRow[] {
  return Array.from({ length: cuantas }, (_sinUsar, indice) => ({
    id: indice,
    codigo: `UB-${String(indice + 1).padStart(5, '0')}`,
    pasillo: `Pasillo ${PASILLOS[indice % PASILLOS.length] ?? 'A'}`,
    ocupacion: (indice * 7) % 101,
  }));
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
