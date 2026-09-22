import type { TableColumn } from './column';
import { readCell } from './table-source';
import { parseTableDate } from './table.tokens';

/**
 * Filas como texto para otra aplicación (portapapeles y CSV): lo que Excel lee como dato, no
 * lo que la pantalla muestra. Números sin separador de miles, fechas `YYYY-MM-DD` y el estado
 * por su etiqueta. Solo columnas visibles, en su orden; `actions` no es un dato. Interno.
 */
export function exportColumns(columns: readonly TableColumn[]): readonly TableColumn[] {
  return columns.filter((column) => column.type() !== 'actions');
}

export function exportCell(column: TableColumn, row: unknown): string {
  const value = readCell(row, column.key());
  if (value === null || value === undefined) {
    return '';
  }
  switch (column.type()) {
    case 'badge':
      return column.badges()[String(value)]?.label ?? String(value);
    case 'date': {
      const date = parseTableDate(value);
      return date === null ? String(value) : isoDate(date);
    }
    case 'number': {
      const number = Number(value);
      return Number.isFinite(number) ? String(number) : String(value);
    }
    default:
      return String(value);
  }
}

/** Encabezados y filas: la primera línea dice qué es cada columna. */
export function exportMatrix(columns: readonly TableColumn[], rows: readonly unknown[]): string[][] {
  const chosen = exportColumns(columns);
  return [
    chosen.map((column) => column.header() || column.key()),
    ...rows.map((row) => chosen.map((column) => exportCell(column, row))),
  ];
}

/** Tabulaciones, como las pega Excel. Un tabulador o salto adentro partiría la celda. */
export function toTsv(matrix: readonly (readonly string[])[]): string {
  return matrix.map((line) => line.map((cell) => cell.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
}

/** RFC 4180: comillas si hace falta, comillas dobladas adentro, CRLF entre filas. */
export function toCsv(matrix: readonly (readonly string[])[]): string {
  const quote = (cell: string): string =>
    /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  return matrix.map((line) => line.map(quote).join(',')).join('\r\n');
}

function isoDate(date: Date): string {
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
