import type { SelectOption } from '@ewms/design-system';
import type { ShipmentRow } from '../components/shipments';
import { SHIPMENTS } from '../components/shipments.fixtures';

/**
 * Registros de ejemplo que simulan lo que mandaría el backend: los almacenes y los clientes van
 * con su nombre tal cual, sin traducir. Lo que la interfaz nombra (el estado) se traduce en
 * shipments.ts.
 */

/** La demo de la tabla, con el almacén que un filtro de pantalla necesita y la tabla no tiene. */
export interface RowWithWarehouse extends ShipmentRow {
  readonly warehouse: string;
}

export const WAREHOUSES: readonly SelectOption[] = [
  { label: 'Central', value: 'central' },
  { label: 'Norte', value: 'norte' },
];

export const ROWS: readonly RowWithWarehouse[] = SHIPMENTS.map((row, index) => ({
  ...row,
  warehouse: index % 2 === 0 ? 'central' : 'norte',
}));

export const CUSTOMERS: readonly SelectOption[] = [
  ...new Set(ROWS.map((row) => row.customer)),
].map((customer) => ({
  label: customer,
  value: customer,
}));
