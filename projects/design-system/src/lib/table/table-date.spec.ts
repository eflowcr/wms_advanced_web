import { parseTableDate } from './table.tokens';

// Toda la suite corre en America/Costa_Rica (UTC-6, vitest.shared.ts): el defecto es
// invisible en UTC. Se veía 14/3/2026 para el 15. Ver vault: Tabla §2.
describe('parseTableDate', () => {
  it('reads a date-only value as that calendar day, in local time', () => {
    const parsed = parseTableDate('2026-03-15');

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    // Base cero: 2 es marzo.
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(15);
  });

  it('puts it at local midnight, which is what pins it to the right day', () => {
    // Atrapa el defecto en cualquier huso: el parseo ingenuo da medianoche local solo en UTC.
    expect(parseTableDate('2026-03-15')?.getHours()).toBe(0);
  });

  it('formats as the 15th, which is the defect seen from the screen', () => {
    // Lo que hace con el resultado la implementación del showroom; antes decía 14/3/2026.
    const parsed = parseTableDate('2026-03-15');

    expect(new Intl.DateTimeFormat('es').format(parsed as Date)).toBe('15/3/2026');
  });

  it('agrees with a date built by hand for the same day', () => {
    const parsed = parseTableDate('2026-03-15');

    expect(parsed?.getTime()).toBe(new Date(2026, 2, 15).getTime());
  });

  it('does not move a value that carries a time and a zone', () => {
    // Un instante sigue siendo instante: 08:00 UTC son las 02:00 del mismo día en Costa Rica.
    const parsed = parseTableDate('2026-03-15T08:00:00Z');

    expect(parsed?.getDate()).toBe(15);
    expect(parsed?.getHours()).toBe(2);
  });

  it('returns null for nothing, and for something that is not a date', () => {
    for (const value of [null, undefined, '', 'sin fecha', 'EXP-2026-0400', {}]) {
      expect(parseTableDate(value), String(value)).toBeNull();
    }
  });

  it('returns null for a date-shaped value that is not a real day', () => {
    // Forma de fecha que no es un día: el constructor la rodaría unos días.
    expect(parseTableDate('2026-02-30')).toBeNull();
    expect(parseTableDate('2026-13-01')).toBeNull();
    // El bisiesto sigue valiendo: rechazarlo sería el mismo defecto al revés.
    expect(parseTableDate('2028-02-29')?.getDate()).toBe(29);
  });
});
