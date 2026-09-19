import { delay, Observable, of, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import type { MenuItem, TablePage, TableQuery, TableSource } from '@ewms/design-system';
import { ArrayTableSource } from '@ewms/design-system';
import { EXPEDICIONES, type ExpedicionRow } from './expediciones';

/**
 * Las fuentes del lote D, todas sintéticas y todas en memoria.
 *
 * NADA DE HTTP Y NADA DE DATOS REALES. Lo que estas clases imitan es el
 * *tiempo* de una fuente remota —un hijo que tarda, un hijo que falla, una
 * página que llega— sin que exista petición alguna. Una demo con red sería una
 * demo que se cae cuando se corta, y el catálogo tiene que poder verse offline.
 */

/** Cuánto tarda en «llegar» un hijo perezoso. Suficiente para verlo. */
const RETRASO_HIJOS = 900;

/**
 * Las cabeceras solas: la demo de detalle y menú no despliega el árbol, porque
 * lo que enseña es el panel y el menú, no la jerarquía.
 */
export const CABECERAS: readonly ExpedicionRow[] = EXPEDICIONES.map(
  ({ hijos: _sinHijos, ...cabecera }) => cabecera,
);

/**
 * Las acciones de una fila.
 *
 * `Anular` es la única coloreada y la última, separada del resto: es la
 * destructiva, y ponerla pegada a `Duplicar` es cómo se anula una expedición
 * queriendo copiarla. `Imprimir` está deshabilitada en la demo para que se vea
 * que una entrada no disponible se queda a la vista —es información— y fuera
 * del recorrido de las flechas.
 */
export const ACCIONES_FILA: readonly MenuItem[] = [
  { id: 'ver', label: 'Ver detalle', icon: 'eye' },
  { id: 'imprimir', label: 'Imprimir albarán', icon: 'label-print', disabled: true },
  { id: 'duplicar', label: 'Duplicar', icon: 'copy' },
  { id: 'anular', label: 'Anular', icon: 'trash', tone: 'danger', separatorBefore: true },
];

/**
 * Los hijos de una cabecera, con retraso, y los de una con incidencia no
 * llegan nunca.
 *
 * `hijos` como FUNCIÓN que devuelve un Observable: la tabla se encarga de la
 * fila «Cargando…» mientras tanto, y de la fila «No se pudo cargar» con su
 * botón de reintentar si el Observable falla. El consumidor no escribe ninguno
 * de esos dos estados. Falla siempre la misma cabecera porque un catálogo que
 * sólo enseña el camino feliz no enseña el componente.
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
 * Cuántas trae la demo antes de que se le pida el lote grande.
 *
 * LA PÁGINA NO CONSTRUYE CINCO MIL FILAS AL ABRIRSE. Sesenta ya se
 * desplazan y ya enseñan la ventana; las cinco mil se cargan con un botón,
 * porque una ficha del catálogo que cuesta cinco mil `<tr>` nada más entrar es
 * una ficha que nadie abre dos veces.
 */
export const UBICACIONES_MUESTRA = 60;

/** El tamaño a partir del cual la ventana deja de ser un lujo. */
export const UBICACIONES_TOTAL = 5000;

/**
 * Una fuente que pagina de verdad: devuelve una página y el total, y por eso
 * la tabla monta el paginador.
 *
 * SIN RETRASO ARTIFICIAL, a diferencia de los hijos perezosos. Allí la espera
 * ES lo que se enseña —la fila «Cargando…»—; aquí sólo serviría para que la
 * página tuviera, durante medio segundo, controles que todavía no existen, y
 * el recorrido de tabulador del e2e los encontró sin haberlos medido.
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
