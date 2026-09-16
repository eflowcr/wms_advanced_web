import { formatIcu, hasIcuSyntax, IcuError, parseIcu } from './icu';

const UNITS_ES = '{count, plural, =0 {Sin bultos} one {# bulto} other {# bultos}}';
const UNITS_EN = '{count, plural, =0 {No packages} one {# package} other {# packages}}';

function format(message: string, params: Record<string, unknown>, locale: string): string {
  return formatIcu(parseIcu(message), params, locale);
}

/** Intl separates thousands with a no-break space in es-CR; compare with plain spaces. */
function plain(text: string): string {
  return text.replace(/\s/g, ' ');
}

describe('ICU interpreter', () => {
  describe('plural', () => {
    it('picks the exact match, then the locale category, in Spanish', () => {
      expect(format(UNITS_ES, { count: 0 }, 'es-CR')).toBe('Sin bultos');
      expect(format(UNITS_ES, { count: 1 }, 'es-CR')).toBe('1 bulto');
      expect(format(UNITS_ES, { count: 2 }, 'es-CR')).toBe('2 bultos');
    });

    it('does the same in English', () => {
      expect(format(UNITS_EN, { count: 0 }, 'en-US')).toBe('No packages');
      expect(format(UNITS_EN, { count: 1 }, 'en-US')).toBe('1 package');
      expect(format(UNITS_EN, { count: 3 }, 'en-US')).toBe('3 packages');
    });

    it('formats # with the locale number format', () => {
      expect(plain(format(UNITS_ES, { count: 12345 }, 'es-CR'))).toBe('12 345 bultos');
      expect(format(UNITS_EN, { count: 12345 }, 'en-US')).toBe('12,345 packages');
    });

    it('accepts a numeric string', () => {
      expect(format(UNITS_EN, { count: '1' }, 'en-US')).toBe('1 package');
    });

    it('applies offset to the category and to #, but not to =N', () => {
      const message =
        '{guests, plural, offset:1 =0 {nadie} =1 {solo tú} one {tú y # más} other {tú y # más}}';
      expect(format(message, { guests: 1 }, 'es-CR')).toBe('solo tú');
      expect(format(message, { guests: 3 }, 'es-CR')).toBe('tú y 2 más');
    });

    it('throws when the parameter is missing or not a number', () => {
      expect(() => format(UNITS_EN, {}, 'en-US')).toThrow(/missing parameter 'count'/);
      expect(() => format(UNITS_EN, { count: 'many' }, 'en-US')).toThrow(IcuError);
    });
  });

  it('selectordinal uses ordinal rules', () => {
    const message = '{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}';
    expect([1, 2, 3, 4, 11, 22].map((place) => format(message, { place }, 'en-US'))).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '22nd',
    ]);
  });

  it('select picks the branch by value and falls back to other', () => {
    const message = '{role, select, supervisor {Supervisora} other {Operario}}';
    expect(format(message, { role: 'supervisor' }, 'es-CR')).toBe('Supervisora');
    expect(format(message, { role: 'picker' }, 'es-CR')).toBe('Operario');
  });

  it('nests: # inside a select inside a plural is the plural number', () => {
    const message = '{count, plural, one {{kind, select, pallet {# tarima} other {# bulto}}} other {# items}}';
    expect(format(message, { count: 1, kind: 'pallet' }, 'es-CR')).toBe('1 tarima');
  });

  it('leaves {{ }} interpolation untouched for Transloco', () => {
    const message = '{count, plural, one {# bulto en {{ location }}} other {# bultos en {{ location }}}}';
    expect(format(message, { count: 2 }, 'es-CR')).toBe('2 bultos en {{ location }}');
  });

  it('honours ICU apostrophe quoting and keeps a lone apostrophe literal', () => {
    expect(format("don't '{' '}' ''", {}, 'en-US')).toBe("don't { } '");
    expect(format("{n, plural, other {'#' is #}}", { n: 5 }, 'en-US')).toBe('# is 5');
  });

  it('keeps # literal outside a plural', () => {
    expect(format('Pedido #42', {}, 'es-CR')).toBe('Pedido #42');
  });

  describe('rejects', () => {
    it.each([
      ['a bare argument', 'Hola {name}', /bare argument '\{name\}'. Parameters are written \{\{ name \}\}/],
      ['number/date formatting in the message', '{n, number}', /unsupported argument type 'number'/],
      ['a plural without other', '{n, plural, one {uno}}', /no 'other' branch/],
      ['an unknown plural category', '{n, plural, some {x} other {y}}', /not a plural category/],
      ['a duplicate selector', '{n, plural, one {a} one {b} other {c}}', /duplicate selector 'one'/],
      ['an unclosed block', '{n, plural, other {x}', /without its closing/],
      ['an unmatched brace', 'hola }', /unmatched '\}'/],
      ['unclosed interpolation', 'Hola {{ name', /without its closing '\}\}'/],
    ])('%s', (_label, message, error) => {
      expect(() => parseIcu(message)).toThrow(error);
    });
  });

  it('hasIcuSyntax skips plain text and pure {{ }} interpolation', () => {
    expect(hasIcuSyntax('Inicio')).toBe(false);
    expect(hasIcuSyntax('Hoy es {{ date }}')).toBe(false);
    expect(hasIcuSyntax(UNITS_ES)).toBe(true);
  });
});
