/**
 * Registros de ejemplo que simulan lo que mandaría el backend: el almacén, sus zonas, pasillos y
 * racks, el código de la ubicación, el cliente y la sesión van tal cual, sin traducir. Lo que
 * la interfaz nombra (Inicio, Almacenes, «Ubicación …») se traduce en navigation.ts.
 */
export const DEEP_TRAIL_RECORDS = {
  warehouse: 'CEDI ePRAC',
  zone: 'Zona A',
  aisle: 'Pasillo 1',
  rack: 'Rack 12',
  location: 'A1-12-03',
} as const;

/** El cliente de la sesión: su logo es el pie del rail en el App Shell. */
export const RAIL_FOOTER_CUSTOMER = 'ePRAC';

/** Versión, usuario y almacén, como los pinta el App Shell al pie de la hoja «Más». */
export const SHEET_FOOTER_STAMP = 'v0.0.0 · Operador · ePrac / 0001 - CEDI_ePRAC';
