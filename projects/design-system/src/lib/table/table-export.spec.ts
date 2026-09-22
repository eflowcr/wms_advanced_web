import { toCsv, toTsv } from './table-export';

describe('table export text', () => {
  it('CSV quotes only what needs it, doubles inner quotes and ends rows in CRLF', () => {
    expect(
      toCsv([
        ['Código', 'Cliente'],
        ['EXP-1', 'Andes, S.A.'],
        ['EXP-2', 'Dijo "hola"'],
      ]),
    ).toBe('Código,Cliente\r\nEXP-1,"Andes, S.A."\r\nEXP-2,"Dijo ""hola"""');
  });

  it('TSV turns a tab or a line break inside a cell into a space: it would split the cell', () => {
    expect(toTsv([['a\tb', 'c\nd']])).toBe('a b\tc d');
  });
});
