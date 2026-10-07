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

  it.each([
    ['=1+1', '"\t=1+1"', "'=1+1"],
    ['+SUM(1,2)', '"\t+SUM(1,2)"', "'+SUM(1,2)"],
    ['-SUM(1,2)', '"\t-SUM(1,2)"', "'-SUM(1,2)"],
    ['-1+1', '"\t-1+1"', "'-1+1"],
    ['@SUM(1,2)', '"\t@SUM(1,2)"', "'@SUM(1,2)"],
    ['  =1+1', '"\t  =1+1"', "'  =1+1"],
    ['\t=1+1', '"\t\t=1+1"', "' =1+1"],
    ['\r\n=1+1', '"\t\r\n=1+1"', "' =1+1"],
    ['\uFEFF=1+1', '"\t\uFEFF=1+1"', "'\uFEFF=1+1"],
    ['＝1+1', '"\t＝1+1"', "'＝1+1"],
    ['＋SUM(1,2)', '"\t＋SUM(1,2)"', "'＋SUM(1,2)"],
    ['－SUM(1,2)', '"\t－SUM(1,2)"', "'－SUM(1,2)"],
    ['＠SUM(1,2)', '"\t＠SUM(1,2)"', "'＠SUM(1,2)"],
    ['=1+2";=1+2', '"\t=1+2"";=1+2"', '"\'=1+2"";=1+2"'],
  ])('exports formula-like text %j as text in CSV and clipboard', (input, csv, tsv) => {
    expect(toCsv([[input]])).toBe(csv);
    expect(toTsv([[input]])).toBe(tsv);
  });

  it('protects both headers and data without splitting quoted CSV cells', () => {
    expect(
      toCsv([
        ['=Header', 'Cliente'],
        ['a,=1+1', 'Andes'],
      ]),
    ).toBe('"\t=Header",Cliente\r\n"a,=1+1",Andes');
    expect(toTsv([['=Header'], ['x\t=1+1']])).toBe("'=Header\nx =1+1");
  });

  it('quotes semicolons so spreadsheet locales cannot split a formula into a new cell', () => {
    expect(
      toCsv([
        ['Cliente', 'Detalle'],
        ['Andes', 'texto;=1+1'],
      ]),
    ).toBe('Cliente,Detalle\r\nAndes,"texto;=1+1"');
  });

  it('escapes clipboard quotes so Excel cannot remove an attacker-supplied pair around a formula', () => {
    expect(toTsv([['"=1+1"', 'Dijo "hola"']])).toBe('"""=1+1"""\t"Dijo ""hola"""');
  });

  it.each(['-42', '+42', '-0.5', '-.5', '-1e-4', '0', '2026-10-05', 'EXP-1', '', 'texto'])(
    'preserves a legitimate number or ordinary text %j',
    (cell) => {
      expect(toCsv([[cell]])).toBe(cell);
      expect(toTsv([[cell]])).toBe(cell);
    },
  );
});
