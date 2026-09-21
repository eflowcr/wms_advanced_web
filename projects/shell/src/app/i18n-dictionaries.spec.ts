import { DICTIONARIES } from './i18n.testing';

/** Paso 2 de la compuerta 12 (check-i18n.mjs): un diccionario atrasado falla antes de CI. */
function keys(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') {
    return [prefix];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    keys(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe('i18n dictionaries', () => {
  it('es.json and en.json have exactly the same keys', () => {
    const es = new Set(keys(DICTIONARIES.es));
    const en = new Set(keys(DICTIONARIES.en));

    expect({
      onlyInEs: [...es].filter((key) => !en.has(key)),
      onlyInEn: [...en].filter((key) => !es.has(key)),
    }).toEqual({ onlyInEs: [], onlyInEn: [] });
    expect(es.size).toBeGreaterThan(0);
  });
});
