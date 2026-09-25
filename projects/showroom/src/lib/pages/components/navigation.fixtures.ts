/**
 * Registros de ejemplo que simulan lo que mandaría el backend: el almacén, sus zonas, pasillos y
 * racks, el código de la ubicación y la sesión del pie del rail van tal cual, sin traducir. Lo que
 * la interfaz nombra (Inicio, Almacenes, «Ubicación …») se traduce en navigation.ts.
 */
export const DEEP_TRAIL_RECORDS = {
  warehouse: 'CEDI ePRAC',
  zone: 'Zona A',
  aisle: 'Pasillo 1',
  rack: 'Rack 12',
  location: 'A1-12-03',
} as const;

/** Usuario, almacén y centro de la sesión, como los pinta el pie del rail en el App Shell. */
export const RAIL_FOOTER_SESSION = 'ePrac / 0001 - CEDI_ePRAC';
