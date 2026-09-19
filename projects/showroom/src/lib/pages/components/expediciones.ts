import type { BadgeDictionary } from '@ewms/design-system';

/**
 * The expediciones demo: THREE LEVELS, generated from a seed.
 *
 * `EXPEDICIONES_CABECERA` → `EXPEDICIONES_DETALLE` → series y lotes, which is
 * the hierarchy the Table's sheet asks for. Twelve headers, three to eight
 * lines each, and every line carrying either serial numbers or batches.
 *
 * SEEDED, SO THE CAPTURES ARE COMPARABLE. A `Math.random()` demo makes every
 * screenshot a different table, and then "the filtered capture" cannot be
 * compared against "the collapsed capture". Same reason the search select's
 * catalogue is seeded.
 *
 * Synthetic throughout. No real data of any customer, ever (PLN-WMS-003 §6).
 *
 *
 * ONE ROW TYPE FOR THREE LEVELS, AND THAT IS THE HONEST SHAPE
 *
 * A cabecera, a línea and a serie are three different things, and a grid shows
 * them in one set of columns anyway -- that is what a tree table IS. So the
 * row is one interface whose fields mean something slightly different at each
 * level (`codigo` is the shipment, then the SKU, then the serial), which is
 * how every WMS grid models this. It is also the argument that decided
 * `[children]`: a homogeneous `children?: T[]` on the row would have forced
 * exactly this merge anyway, and then asked the model to carry view state too.
 */
export interface ExpedicionRow {
  readonly id: string;
  readonly nivel: 'cabecera' | 'linea' | 'serie';
  readonly codigo: string;
  readonly cliente: string;
  /** ISO 8601, so it sorts and filters as a string without a parse. */
  readonly fecha: string;
  readonly bultos: number;
  readonly estado: EstadoExpedicion;
  readonly hijos?: readonly ExpedicionRow[];
}

export type EstadoExpedicion = 'pendiente' | 'en-proceso' | 'completada' | 'con-incidencia';

/**
 * THE CENTRAL DICTIONARY, and the only place a state becomes a colour or a
 * word.
 *
 * The table's `badge` column draws from it and `rowState="estado"` reads the
 * same object for the row's tint, so the two cannot disagree. The mapping is
 * the one the Tabla sheet fixed: Pendiente neutral, En proceso warning,
 * Completada success, Con incidencia danger.
 */
export const ESTADOS: BadgeDictionary = {
  pendiente: { variant: 'neutral', label: 'Pendiente' },
  'en-proceso': { variant: 'warning', label: 'En proceso' },
  completada: { variant: 'success', label: 'Completada' },
  'con-incidencia': { variant: 'danger', label: 'Con incidencia' },
};

const CLIENTES = [
  'Distribuidora Andes',
  'Comercial del Valle',
  'Ferretería Norte',
  'Alimentos Pacífico',
  'Textiles Sur',
  'Importadora Centro',
] as const;

const ARTICULOS = [
  'Caja plegable 60x40',
  'Film estirable 23 micras',
  'Etiqueta térmica 100x150',
  'Fleje de poliéster 13 mm',
  'Separador de cartón',
  'Palet de plástico 120x100',
  'Esquinero de cartón',
  'Bolsa de burbuja',
] as const;

const ESTADO_KEYS: readonly EstadoExpedicion[] = [
  'pendiente',
  'en-proceso',
  'completada',
  'con-incidencia',
];

/** xorshift32: four lines, no state to get wrong, same sequence every time. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return Math.abs(state) / 2 ** 31;
  };
}

function pick<T>(random: () => number, from: readonly T[]): T {
  return from[Math.floor(random() * from.length)] as T;
}

/** Twelve headers, identical on every load. */
export const EXPEDICIONES: readonly ExpedicionRow[] = buildExpediciones();

function buildExpediciones(): readonly ExpedicionRow[] {
  const random = seeded(20260919);
  const cabeceras: ExpedicionRow[] = [];

  for (let index = 0; index < 12; index += 1) {
    const lineCount = 3 + Math.floor(random() * 6);
    const lineas: ExpedicionRow[] = [];

    for (let line = 0; line < lineCount; line += 1) {
      const bultos = 1 + Math.floor(random() * 40);
      const estado = pick(random, ESTADO_KEYS);
      /*
       * A line carries either serials or batches, never both: a serialised
       * article is tracked one unit at a time and a batched one is tracked by
       * lot, and no warehouse does both to the same SKU.
       */
      const serialised = random() > 0.5;
      const childCount = 1 + Math.floor(random() * 3);
      const hijos: ExpedicionRow[] = [];

      for (let child = 0; child < childCount; child += 1) {
        hijos.push({
          id: `EXP-${index}-${line}-${child}`,
          nivel: 'serie',
          codigo: serialised
            ? `SN-${String(400000 + index * 100 + line * 10 + child)}`
            : `LOTE-${String(2026000 + index * 10 + child)}`,
          cliente: serialised ? 'Serie' : 'Lote',
          fecha: isoDate(random),
          bultos: serialised ? 1 : Math.max(1, Math.floor(bultos / childCount)),
          estado,
        });
      }

      lineas.push({
        id: `EXP-${index}-${line}`,
        nivel: 'linea',
        codigo: `SKU-${String(88000 + index * 10 + line)}`,
        cliente: pick(random, ARTICULOS),
        fecha: isoDate(random),
        bultos,
        estado,
        hijos,
      });
    }

    cabeceras.push({
      id: `EXP-${index}`,
      nivel: 'cabecera',
      codigo: `EXP-2026-${String(400 + index).padStart(4, '0')}`,
      cliente: pick(random, CLIENTES),
      fecha: isoDate(random),
      bultos: lineas.reduce((total, linea) => total + linea.bultos, 0),
      estado: pick(random, ESTADO_KEYS),
      hijos: lineas,
    });
  }

  return cabeceras;
}

/** A date in the first quarter of 2026, as ISO 8601. */
function isoDate(random: () => number): string {
  const month = 1 + Math.floor(random() * 3);
  const day = 1 + Math.floor(random() * 28);
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
