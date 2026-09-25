import type { SelectOption } from '@ewms/design-system';
import type { ExpedicionRow } from '../components/expediciones';
import { EXPEDICIONES } from '../components/expediciones.fixtures';

/**
 * Registros de ejemplo que simulan lo que mandaría el backend: los almacenes y los clientes van
 * con su nombre tal cual, sin traducir. Lo que la interfaz nombra (el estado) se traduce en
 * expediciones.ts.
 */

/** La demo de la tabla, con el almacén que un filtro de pantalla necesita y la tabla no tiene. */
export interface FilaConAlmacen extends ExpedicionRow {
  readonly almacen: string;
}

export const ALMACENES: readonly SelectOption[] = [
  { label: 'Central', value: 'central' },
  { label: 'Norte', value: 'norte' },
];

export const FILAS: readonly FilaConAlmacen[] = EXPEDICIONES.map((fila, indice) => ({
  ...fila,
  almacen: indice % 2 === 0 ? 'central' : 'norte',
}));

export const CLIENTES: readonly SelectOption[] = [
  ...new Set(FILAS.map((fila) => fila.cliente)),
].map((cliente) => ({
  label: cliente,
  value: cliente,
}));
