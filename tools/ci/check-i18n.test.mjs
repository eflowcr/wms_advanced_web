/**
 * Pruebas de los controles puros de la regla 12 (ADR 0008). El paso de keys-manager es
 * una CLI y lo ejercita `npm run lint:i18n`.
 *
 * node:test sin Angular. `npm run test:tools` (parte de `npm test`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalJson,
  checkStructure,
  checkSameKeys,
  compareKeySets,
  dictionaryGroups,
  findHardcodedLiterals,
  findHardcodedText,
  flattenKeys,
  inlineTemplates,
  scansLiterals,
} from './check-i18n.mjs';

const messages = (template) => findHardcodedText(template).map(({ message }) => message);

describe('findHardcodedText', () => {
  it('flags visible text and the text around an interpolation', () => {
    assert.deepEqual(messages('<h1>Inventario</h1>\n<p>Total: {{ count }}</p>'), [
      'hardcoded text "Inventario"',
      'hardcoded text around an interpolation: "Total:"',
    ]);
  });

  it('reports the line of each finding', () => {
    const [finding] = findHardcodedText('<div>\n\n  <span>Guardar</span>\n</div>');
    assert.equal(finding?.line, 3);
  });

  it('passes text that only goes through the transloco pipe', () => {
    assert.deepEqual(
      messages(`<h1>{{ 'inventory.title' | transloco }}</h1>
        <p>{{ 'inventory.unitsFound' | transloco: { count } }}</p>`),
      [],
    );
  });

  it('flags literal human-facing attributes, static or bound', () => {
    assert.deepEqual(
      messages(
        `<button aria-label="Cerrar" [attr.title]="'Guardar'" placeholder="Buscar"></button>`,
      ),
      [
        'hardcoded text in aria-label="Cerrar"',
        'hardcoded text in placeholder="Buscar"',
        `hardcoded text in [title]="'Guardar'"`,
      ],
    );
  });

  it('ignores technical attributes and translated attribute bindings', () => {
    assert.deepEqual(
      messages(`<a class="text-secondary" id="nav" routerLink="/inventory" data-sample="date"
        type="button" [attr.aria-label]="'common.actions.close' | transloco"></a>`),
      [],
    );
  });

  it('does not look inside <code> or <pre>', () => {
    assert.deepEqual(messages('<code>npm run build</code><pre>ng serve\nshell</pre>'), []);
  });

  it('passes text with no letter in it: separators, symbols, numbers', () => {
    assert.deepEqual(messages('<span>{{ a }} · {{ b }}</span><span>— / 24 ×</span>&nbsp;'), []);
  });

  it('finds text inside control-flow blocks', () => {
    assert.deepEqual(messages('@if (ok) { <p>Listo</p> } @else { <p>{{ x }}</p> }'), [
      'hardcoded text "Listo"',
    ]);
  });
});

describe('inlineTemplates', () => {
  it('extracts backtick and quoted templates with their starting line', () => {
    const source =
      "@Component({\n  selector: 'x',\n  template: `<p>\n Hola</p>`,\n})\nclass A {}\n";
    assert.deepEqual(inlineTemplates(source), [{ template: '<p>\n Hola</p>', line: 3 }]);
  });
});

describe('compareKeySets', () => {
  it('names the keys missing and extra on the other side', () => {
    const es = { common: { actions: { save: 'Guardar', cancel: 'Cancelar' } } };
    const en = { common: { actions: { save: 'Save', delete: 'Delete' } } };
    assert.deepEqual(compareKeySets(es, en), {
      missing: ['common.actions.cancel'],
      extra: ['common.actions.delete'],
    });
  });
});

describe('dictionaryGroups', () => {
  const LANGS = ['es', 'en'];

  it('groups the root and each scope, one file per language', () => {
    const { groups, problems } = dictionaryGroups(
      ['es.json', 'en.json', 'showroom/es.json', 'showroom/en.json'],
      LANGS,
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(
      [...groups].map(([scope, files]) => [scope, Object.fromEntries(files)]),
      [
        [null, { es: 'es.json', en: 'en.json' }],
        ['showroom', { es: 'showroom/es.json', en: 'showroom/en.json' }],
      ],
    );
  });

  it('names the language a scope lacks, as it does for the root', () => {
    const { problems } = dictionaryGroups(['es.json', 'showroom/es.json'], LANGS);
    assert.deepEqual(problems, [
      'en.json is missing. Every language in LANGUAGES needs its dictionary, in the root and in every scope.',
      'showroom/en.json is missing. Every language in LANGUAGES needs its dictionary, in the root and in every scope.',
    ]);
  });

  it('rejects a file for a language the application does not have', () => {
    const { problems } = dictionaryGroups(['es.json', 'en.json', 'showroom/fr.json'], LANGS);
    assert.deepEqual(problems, ["showroom/fr.json: 'fr' is not a language in LANGUAGES."]);
  });

  it('compares each scope against its own reference, never against the root', () => {
    const dictionary = (file, data) => ({ file, raw: '', data });
    const problems = checkSameKeys([
      {
        scope: null,
        dictionaries: new Map([
          ['es', dictionary('es.json', { common: { save: 'Guardar' } })],
          ['en', dictionary('en.json', { common: { save: 'Save' } })],
        ]),
      },
      {
        scope: 'showroom',
        dictionaries: new Map([
          ['es', dictionary('showroom/es.json', { catalog: { button: 'Botón', text: 'Texto' } })],
          ['en', dictionary('showroom/en.json', { catalog: { button: 'Button' } })],
        ]),
      },
    ]);
    assert.deepEqual(problems, [
      {
        file: 'showroom/en.json',
        line: 0,
        message: 'lacks 1 key(s) that showroom/es.json has: catalog.text',
      },
    ]);
  });
});

describe('canonicalJson', () => {
  it('sorts keys recursively with 2-space indent and a final LF', () => {
    assert.equal(
      canonicalJson({ b: { d: '1', c: '2' }, a: '3' }),
      '{\n  "a": "3",\n  "b": {\n    "c": "2",\n    "d": "1"\n  }\n}\n',
    );
  });

  it('keeps non-ASCII text readable', () => {
    assert.match(canonicalJson({ a: 'Sistema de diseño' }), /diseño/);
  });
});

describe('checkStructure', () => {
  it('accepts camelCase segments with valid ICU values', () => {
    assert.deepEqual(
      checkStructure({
        inventory: { unitsFound: '{count, plural, one {# bulto} other {# bultos}}' },
      }),
      [],
    );
  });

  it('rejects bad segments, empty or non-string values and invalid ICU', () => {
    assert.deepEqual(
      checkStructure({
        Inventory: { 'units-found': 'x' },
        common: { empty: ' ', list: ['a'], plural: '{n, plural, one {#}}' },
      }),
      [
        "'Inventory.units-found': segment(s) 'Inventory', 'units-found' not camelCase",
        "'common.empty': the value must be a non-empty string",
        "'common.list': the value must be a non-empty string",
        "'common.plural': invalid ICU: '{n, plural}' has no 'other' branch (at 0 in \"{n, plural, one {#}}\")",
      ],
    );
  });

  it('flattens nested dictionaries into dotted keys', () => {
    assert.deepEqual(flattenKeys({ a: { b: 'x' }, c: 'y' }), [
      ['a.b', 'x'],
      ['c', 'y'],
    ]);
  });
});

const literals = (source) => findHardcodedLiterals(source).found.map(({ text }) => text);

describe('findHardcodedLiterals', () => {
  it('flags human text in string and template literals, with its line', () => {
    const source = [
      "const title = 'Crear expedición';",
      'const hint = `Pruebe con otra búsqueda: ${query}`;',
      "toast.show('Saved the shipment');",
    ].join('\n');
    assert.deepEqual(findHardcodedLiterals(source).found, [
      { line: 1, text: 'Crear expedición' },
      { line: 2, text: 'Pruebe con otra búsqueda:' },
      { line: 3, text: 'Saved the shipment' },
    ]);
  });

  it('passes identifiers, tokens, single words and dictionary keys', () => {
    const source = [
      "const a = 'aria-describedby';",
      "const b = '--color-bg-primary';",
      "const c = 'Escape';",
      "const d = 'showroom.table.columns.code';",
      "const e = 'shell.menu.';",
    ].join('\n');
    assert.deepEqual(literals(source), []);
  });

  it('skips imports, dynamic imports and component metadata', () => {
    const source = [
      "import { x } from './una ruta con espacios';",
      "export { y } from './otra ruta rara';",
      "const lazy = () => import('./página de catálogo');",
      "@Component({ selector: 'ewms-x', host: { 'aria-label': 'Menú principal' } })",
      'class X {}',
    ].join('\n');
    assert.deepEqual(literals(source), []);
  });

  it('skips class strings by their declared name: *_CLASSES, class, classes, *Classes', () => {
    const source = [
      "const ROW_CLASSES = 'group bg-surface hover:bg-row-hover';",
      "const host = { class: 'block min-w-0 text-primary', classes: 'flex gap-2 items-center' };",
      "function toneClasses() { return 'cursor-pointer text-danger'; }",
      "const boxClass = 'rounded-md border border-default';",
    ].join('\n');
    assert.deepEqual(literals(source), []);
  });

  it('skips what is thrown and what goes to the console', () => {
    const source = [
      "throw new Error('the source refused the query');",
      "throw this.error('quoted text without its closing apostrophe');",
      "const e = new DictionaryUnavailableError('the dictionary could not be loaded');",
      "console.warn('falta la clave en el diccionario');",
    ].join('\n');
    assert.deepEqual(literals(source), []);
  });

  it('skips CSS selectors handed to the DOM', () => {
    const source = [
      "host.querySelector('thead tr');",
      "el.closest('tbody td');",
      "el.matches('li a');",
    ].join('\n');
    assert.deepEqual(literals(source), []);
  });

  it('treats text with code syntax as code: markup, types, assignments', () => {
    const source = [
      "const a = '<!-- en el botón de solo ícono lo pone label -->';",
      "const b = 'readonly SelectOption[] | readonly T[]';",
      "const c = 'protected readonly porId = (row) => row.id;';",
    ].join('\n');
    assert.deepEqual(literals(source), []);
  });

  it('honours an escape with a reason, on its own line or on the one before', () => {
    const source = [
      "const a = 'Texto a sabiendas'; // i18n-exempt: nombre propio del proveedor",
      '// i18n-exempt: marca de un tercero',
      "const b = 'Otro texto a sabiendas';",
      "const c = 'Sin razón no vale'; // i18n-exempt:",
    ].join('\n');
    const { found, escaped } = findHardcodedLiterals(source);
    assert.deepEqual(found, [{ line: 4, text: 'Sin razón no vale' }]);
    assert.deepEqual(escaped, [
      { line: 1, text: 'Texto a sabiendas', reason: 'nombre propio del proveedor' },
      { line: 3, text: 'Otro texto a sabiendas', reason: 'marca de un tercero' },
    ]);
  });

  it('does not let an escape on a line of code reach the next line', () => {
    const source = [
      "const a = 'uno'; // i18n-exempt: esto es solo para esta línea",
      "const b = 'Texto que sí cuenta';",
    ].join('\n');
    assert.deepEqual(literals(source), ['Texto que sí cuenta']);
  });
});

describe('scansLiterals', () => {
  it('reads production TypeScript', () => {
    assert.equal(scansLiterals('projects/shell/src/app/layout/menu.ts'), true);
    assert.equal(scansLiterals('projects/showroom/src/lib/pages/foundations/brand.ts'), true);
  });

  it('skips specs, test support, sample records and the brand', () => {
    assert.equal(scansLiterals('projects/shell/src/app/layout/menu.spec.ts'), false);
    assert.equal(scansLiterals('projects/showroom/src/lib/showroom.testing.ts'), false);
    assert.equal(scansLiterals('projects/testing/src/lib/a11y.ts'), false);
    assert.equal(
      scansLiterals('projects/showroom/src/lib/pages/components/table.fixtures.ts'),
      false,
    );
    assert.equal(scansLiterals('projects/shell/src/app/brand.ts'), false);
    assert.equal(scansLiterals('projects/shell/src/app/app.html'), false);
  });
});
