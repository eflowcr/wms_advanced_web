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
  compareKeySets,
  findHardcodedText,
  flattenKeys,
  inlineTemplates,
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
      messages(`<button aria-label="Cerrar" [attr.title]="'Guardar'" placeholder="Buscar"></button>`),
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
    const source = "@Component({\n  selector: 'x',\n  template: `<p>\n Hola</p>`,\n})\nclass A {}\n";
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
      checkStructure({ inventory: { unitsFound: '{count, plural, one {# bulto} other {# bultos}}' } }),
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
