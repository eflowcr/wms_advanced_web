import type { EstadoExpedicion } from './expediciones';

/**
 * Registros de ejemplo de la ficha Tabla que simulan lo que mandaría el backend: ubicaciones,
 * pasillos y el error de una fuente remota van tal cual, sin traducir, como las expediciones de
 * expediciones.fixtures.ts.
 */

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

/** El código de la fila de muestra en la matriz de fila: una expedición cualquiera de la demo. */
export const CODIGO_MUESTRA = 'EXP-2026-0400';

/** El estado de las cabeceras cuyos hijos nunca llegan: la fuente simulada falla siempre con él. */
export const ESTADO_QUE_FALLA: EstadoExpedicion = 'con-incidencia';

/** Lo que contesta la fuente simulada cuando falla. */
export const SIN_RESPUESTA = 'sin respuesta';
