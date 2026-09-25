/**
 * Registros de ejemplo que simulan lo que mandaría el backend: el nombre de cada almacén va tal
 * cual, sin traducir. Lo que la interfaz escribe alrededor (muelles, pasillos, «en mantenimiento»)
 * se traduce en card.html.
 */
export interface Warehouse {
  readonly value: string;
  readonly name: string;
  /** Muelles y pasillos; null mientras el almacén está en mantenimiento. */
  readonly capacity: { readonly docks: number; readonly aisles: number } | null;
  readonly disabled: boolean;
}

/** El que el formulario siembra y el que muestra cada celda de la matriz de estados. */
export const CENTRAL: Warehouse = {
  value: 'central',
  name: 'Central',
  capacity: { docks: 9, aisles: 34 },
  disabled: false,
};

/** Selector de almacén de la ficha; el cuarto no está disponible. */
export const WAREHOUSES: readonly Warehouse[] = [
  { value: 'norte', name: 'Norte', capacity: { docks: 4, aisles: 12 }, disabled: false },
  CENTRAL,
  {
    value: 'devoluciones',
    name: 'Devoluciones',
    capacity: { docks: 1, aisles: 4 },
    disabled: false,
  },
  { value: 'sur', name: 'Sur', capacity: null, disabled: true },
];
