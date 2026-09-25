import type { SelectOption } from '@ewms/design-system';

/*
 * Registros de ejemplo de la ficha del Select: simulan lo que mandaría el backend (ubicaciones y
 * artículos) y van tal cual, sin traducir. Lo que la interfaz nombra (un estado) se traduce en
 * select.ts. Sintéticos: nunca datos reales de un cliente (PLN-WMS-003 §6).
 */

/** Cinco ubicaciones: las usan la matriz, los tamaños y el filtro con la etiqueta oculta. */
export const LOCATION_OPTIONS: readonly SelectOption[] = [
  { value: 'central', label: 'Almacén central' },
  { value: 'muelle-3', label: 'Muelle 3' },
  { value: 'cuarentena', label: 'Cuarentena' },
  { value: 'devoluciones', label: 'Devoluciones' },
  { value: 'transito', label: 'En tránsito' },
];

/** Veinticuatro racks: la lista larga filtra en memoria, sin fuente. */
export const RACK_OPTIONS: readonly SelectOption[] = Array.from(
  { length: 24 },
  (_unused, index) => {
    const aisle = String.fromCharCode(65 + Math.floor(index / 6));
    const rack = String((index % 6) + 1).padStart(2, '0');
    return { value: `${aisle}-${rack}`, label: `Pasillo ${aisle}, rack ${rack}` };
  },
);

/** Familias del catálogo sintético de search-catalogue.ts. */
export const ARTICLE_FAMILIES = [
  'Embalaje',
  'Film y flejes',
  'Etiquetas',
  'Repuestos',
  'Consumibles',
  'Higiene',
] as const;

/** Formas con las que search-catalogue.ts arma el nombre de cada artículo. */
export const ARTICLE_SHAPES = [
  'Caja plegable',
  'Caja americana',
  'Film estirable',
  'Fleje de poliéster',
  'Etiqueta térmica',
  'Separador de cartón',
  'Esquinero',
  'Bolsa de burbuja',
  'Cinta de embalar',
  'Palet de plástico',
] as const;
