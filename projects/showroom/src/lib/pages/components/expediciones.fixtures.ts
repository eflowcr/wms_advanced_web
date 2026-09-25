import type { EstadoExpedicion, ExpedicionRow } from './expediciones';

/**
 * Registros de ejemplo que simulan lo que mandaría el backend: clientes, artículos y el texto de
 * cada fila van tal cual, sin traducir. Lo que la interfaz nombra (el estado) se traduce en
 * expediciones.ts. Sintética y con semilla para que las capturas sean comparables.
 */
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
      // Series o lotes, nunca ambos: ningún almacén rastrea un mismo SKU de las dos formas.
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

/** Fecha del primer trimestre de 2026, en ISO 8601. */
function isoDate(random: () => number): string {
  const month = 1 + Math.floor(random() * 3);
  const day = 1 + Math.floor(random() * 28);
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
