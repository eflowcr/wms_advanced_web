import type { ShipmentStatus, ShipmentRow } from './shipments';

/**
 * Registros de ejemplo que simulan lo que mandaría el backend: clientes, artículos y el texto de
 * cada fila van tal cual, sin traducir. Lo que la interfaz nombra (el estado) se traduce en
 * shipments.ts. Sintética y con semilla para que las capturas sean comparables.
 */
const CUSTOMERS = [
  'Distribuidora Andes',
  'Comercial del Valle',
  'Ferretería Norte',
  'Alimentos Pacífico',
  'Textiles Sur',
  'Importadora Centro',
] as const;

const ARTICLES = [
  'Caja plegable 60x40',
  'Film estirable 23 micras',
  'Etiqueta térmica 100x150',
  'Fleje de poliéster 13 mm',
  'Separador de cartón',
  'Palet de plástico 120x100',
  'Esquinero de cartón',
  'Bolsa de burbuja',
] as const;

const STATUS_KEYS: readonly ShipmentStatus[] = [
  'pendiente',
  'en-proceso',
  'completada',
  'con-incidencia',
];

/** xorshift32: la misma secuencia en cada carga. */
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

/** Doce cabeceras, idénticas en cada carga. */
export const SHIPMENTS: readonly ShipmentRow[] = buildShipments();

function buildShipments(): readonly ShipmentRow[] {
  const random = seeded(20260919);
  const headers: ShipmentRow[] = [];

  for (let index = 0; index < 12; index += 1) {
    const lineCount = 3 + Math.floor(random() * 6);
    const lines: ShipmentRow[] = [];

    for (let line = 0; line < lineCount; line += 1) {
      const packages = 1 + Math.floor(random() * 40);
      const status = pick(random, STATUS_KEYS);
      // Series o lotes, nunca ambos: ningún almacén rastrea un mismo SKU de las dos formas.
      const serialised = random() > 0.5;
      const childCount = 1 + Math.floor(random() * 3);
      const children: ShipmentRow[] = [];

      for (let child = 0; child < childCount; child += 1) {
        children.push({
          id: `EXP-${index}-${line}-${child}`,
          level: 'serie',
          code: serialised
            ? `SN-${String(400000 + index * 100 + line * 10 + child)}`
            : `LOTE-${String(2026000 + index * 10 + child)}`,
          customer: serialised ? 'Serie' : 'Lote',
          date: isoDate(random),
          packages: serialised ? 1 : Math.max(1, Math.floor(packages / childCount)),
          status,
        });
      }

      lines.push({
        id: `EXP-${index}-${line}`,
        level: 'linea',
        code: `SKU-${String(88000 + index * 10 + line)}`,
        customer: pick(random, ARTICLES),
        date: isoDate(random),
        packages,
        status,
        children,
      });
    }

    headers.push({
      id: `EXP-${index}`,
      level: 'cabecera',
      code: `EXP-2026-${String(400 + index).padStart(4, '0')}`,
      customer: pick(random, CUSTOMERS),
      date: isoDate(random),
      packages: lines.reduce((total, lineRow) => total + lineRow.packages, 0),
      status: pick(random, STATUS_KEYS),
      children: lines,
    });
  }

  return headers;
}

/** Fecha del primer trimestre de 2026, en ISO 8601. */
function isoDate(random: () => number): string {
  const month = 1 + Math.floor(random() * 3);
  const day = 1 + Math.floor(random() * 28);
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
