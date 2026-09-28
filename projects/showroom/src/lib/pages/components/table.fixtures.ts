import type { ShipmentStatus } from './shipments';

/**
 * Registros de ejemplo de la ficha Tabla que simulan lo que mandaría el backend: ubicaciones,
 * pasillos y el error de una fuente remota van tal cual, sin traducir, como las expediciones de
 * shipments.fixtures.ts.
 */

/** Una fila de la tabla grande. Dos columnas: lo justo para que se note la altura. */
export interface LocationRow {
  readonly id: number;
  readonly code: string;
  readonly aisle: string;
  readonly occupancy: number;
}

const AISLES = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Ubicaciones generadas, no traídas. */
export function generateLocations(count: number): readonly LocationRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: index,
    code: `UB-${String(index + 1).padStart(5, '0')}`,
    aisle: `Pasillo ${AISLES[index % AISLES.length] ?? 'A'}`,
    occupancy: (index * 7) % 101,
  }));
}

/** El código de la fila de muestra en la matriz de fila: una expedición cualquiera de la demo. */
export const SAMPLE_CODE = 'EXP-2026-0400';

/** El estado de las cabeceras cuyos hijos nunca llegan: la fuente simulada falla siempre con él. */
export const FAILING_STATUS: ShipmentStatus = 'con-incidencia';

/** Lo que contesta la fuente simulada cuando falla. */
export const NO_ANSWER = 'sin respuesta';
