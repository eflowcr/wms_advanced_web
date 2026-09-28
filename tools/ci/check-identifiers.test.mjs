// La compuerta de identificadores en inglés, con casos: qué nombres mira, cuáles no y el repositorio
// entero en verde. `npm run test:tools`. Ver vault: Nomenclatura de Componentes y Tokens.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { findSpanishIdentifiers, spanishDeclarations, spanishWord, words } from './check-identifiers.mjs';

const names = (source) => spanishDeclarations(source).map(({ name }) => name);

describe('words', () => {
  it('splits camelCase, PascalCase, SNAKE_CASE and kebab-case into lowercase words', () => {
    assert.deepEqual(words('injectEstadoOptions'), ['inject', 'estado', 'options']);
    assert.deepEqual(words('ExpedicionRow'), ['expedicion', 'row']);
    assert.deepEqual(words('ESTADO_QUE_FALLA'), ['estado', 'que', 'falla']);
    assert.deepEqual(words('expediciones-avanzado.fixtures.ts'), ['expediciones', 'avanzado', 'fixtures', 'ts']);
    assert.deepEqual(words('HTMLInputElement'), ['html', 'input', 'element']);
  });
});

describe('spanishWord', () => {
  it('finds a Spanish root and its family, as a whole word', () => {
    assert.equal(spanishWord('porUbicacion'), 'por');
    assert.equal(spanishWord('PAGINAS'), 'paginas');
    assert.equal(spanishWord('paginada'), 'paginada');
    assert.equal(spanishWord('generarUbicaciones'), 'generar');
    assert.equal(spanishWord('cabeceras'), 'cabeceras');
  });

  it('leaves English words that only look alike: pagination, series, element, locales', () => {
    for (const name of ['pagination', 'paginator', 'series', 'el', 'LOCALES_ES', 'UNITS_EN', 'isNaN', 'activate', 'code']) {
      assert.equal(spanishWord(name), null, name);
    }
  });
});

describe('spanishDeclarations', () => {
  it('reports every kind of declared name', () => {
    const source = [
      'class Expedicion {}',
      'interface UbicacionRow { readonly codigo: string }',
      'type Estado = string;',
      'function guardar(fila: number) {}',
      'const limpiar = 1;',
      'const { seleccion } = x;',
      'const row = { cliente: 1, fecha };',
      'class A { private consulta = 0; abrir() {} get paginas() { return 1; } }',
      'enum Nivel { Cabecera }',
    ].join('\n');
    assert.deepEqual(names(source), [
      'Expedicion', 'UbicacionRow', 'codigo', 'Estado', 'guardar', 'fila', 'limpiar', 'seleccion',
      'cliente', 'fecha', 'consulta', 'abrir', 'paginas', 'Nivel', 'Cabecera',
    ]);
  });

  it('does not read strings, comments or the names of what it uses from elsewhere', () => {
    const source = [
      "const title = 'Expediciones y ubicaciones';",
      '// guardar, limpiar, seleccion',
      '/** Las cabeceras de la tabla. */',
      "const status = { 'pendiente': 1, 'con-incidencia': 2 };",
      'foo.estado();',
    ].join('\n');
    assert.deepEqual(names(source), []);
  });

  it('says where it found the name', () => {
    assert.deepEqual(spanishDeclarations('\n\nconst bultos = 3;'), [{ name: 'bultos', word: 'bultos', line: 3 }]);
  });
});

describe('the repository', () => {
  it('declares no Spanish identifier and names no file in Spanish, in projects/ and e2e/', () => {
    assert.deepEqual(
      findSpanishIdentifiers().map(({ file, line, name }) => `${file}:${line} ${name}`),
      [],
    );
  });

  it('is what CI runs: lint:identifiers is a step of verify', () => {
    const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
    assert.match(workflow, /run: npm run lint:identifiers$/m);
  });
});
