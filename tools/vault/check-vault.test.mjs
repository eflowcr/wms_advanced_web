// Las compuertas del vault contra vaults de juguete: cada regla con un caso que pasa y uno que no.
// `npm run test:tools`; contra el vault real, `npm run vault:check -- <ruta>`. Ver vault: CLAUDE.md.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  checkVault,
  forbiddenPhrases,
  frontmatterProblems,
  frontmatterRules,
  hasSection,
  headingKey,
  parseReference,
  referenceText,
  resolveTarget,
  wikilinks,
} from './check-vault.mjs';

const CLAUDE = [
  '# Convenciones',
  '```yaml',
  '---',
  'type: proyecto | arquitectura | adr | meta',
  'title: "Título"',
  'status: seed | developing | mature | evergreen',
  'created: AAAA-MM-DD',
  'updated: AAAA-MM-DD',
  'tags: []',
  'related: []',
  '---',
  '```',
  '| Estado | Dónde |',
  '|---|---|',
  '| `listo` | Fichas |',
].join('\n');

const note = (body, fields = {}) =>
  [
    '---',
    ...Object.entries({
      type: 'meta',
      title: '"Nota"',
      status: 'mature',
      created: '2026-09-28',
      updated: '2026-09-28',
      tags: '[]',
      related: '[]',
      ...fields,
    }).map(([key, value]) => `${key}: ${value}`),
    '---',
    '',
    body,
  ].join('\n');

const roots = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

/** Un vault de juguete: `{ 'ruta.md': 'texto' }`, con su CLAUDE.md. */
function vault(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'vault-'));
  roots.push(root);
  for (const [file, content] of Object.entries({ 'CLAUDE.md': CLAUDE, ...files })) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  return root;
}

const problems = (root, check) => checkVault(root, [check]).find(({ name }) => name === check).problems;

describe('links', () => {
  const files = ['a/Nota.md', 'a/b/Otra.md', 'img/foto.png', 'Raiz.md'];

  it('resolve like Obsidian: relative to the note, from the root, or by file name', () => {
    assert.equal(resolveTarget(files, 'a/b/Otra.md', '../Nota'), 'a/Nota.md');
    assert.equal(resolveTarget(files, 'Raiz.md', 'a/b/Otra'), 'a/b/Otra.md');
    assert.equal(resolveTarget(files, 'a/Nota.md', 'Raiz'), 'Raiz.md');
    assert.equal(resolveTarget(files, 'a/Nota.md', 'foto.png'), 'img/foto.png');
    assert.equal(resolveTarget(files, 'a/Nota.md', 'No existe'), null);
  });

  it('read the target, the headings and the alias, and nothing inside code', () => {
    const text = 'Ver [[Nota#Uno#Dos|alias]] y `[[Falsa]]`.\n| [[Otra\\|en tabla]] |\n![[foto.png]]';
    assert.deepEqual(
      wikilinks(text).map(({ target, sections, embed, line }) => [target, sections, embed, line]),
      [
        ['Nota', ['Uno', 'Dos'], false, 1],
        ['Otra', [], false, 2],
        ['foto.png', [], true, 3],
      ],
    );
  });

  it('compare a heading as Obsidian does, without formatting', () => {
    assert.equal(headingKey('4. Los cuatro jobs de `ci.yml`'), headingKey('4. Los cuatro jobs de ci.yml'));
  });

  it('fail on a note or a heading that does not exist, and pass on one that does', () => {
    const root = vault({
      'A.md': note('# A\n## Sección real'),
      'B.md': note('[[A#Sección real]] [[A#Otra]] [[C]]'),
    });
    assert.deepEqual(problems(root, 'links'), [
      'B.md:11 [[A#Otra]] has no such heading',
      'B.md:11 [[C]] does not resolve to a note',
    ]);
  });
});

describe('wording', () => {
  it('finds each forbidden phrase with its line, outside code', () => {
    const text = note('Antes era así.\nSe cambió en su momento.\n`antes` en código\n(pendiente, CTO)');
    assert.deepEqual(
      forbiddenPhrases(text).map(({ phrase, line }) => `${line} ${phrase}`),
      ['11 antes', '12 se cambió', '12 en su momento', '14 (pendiente)'],
    );
  });

  it('catches a dated story and a history section', () => {
    const text = note('Desde el 2026-09-26 falla.\nEstado al 2026-09-27: bien.\n## Historial');
    assert.deepEqual(
      forbiddenPhrases(text).map(({ phrase }) => phrase),
      ['desde/hasta una fecha', 'estado al…', 'Historial'],
    );
  });

  it('leaves the rules alone: «antes de» and «antes que» are not a story', () => {
    assert.deepEqual(forbiddenPhrases(note('Antes de cerrar, correr la compuerta.')), []);
  });

  it('catches a branch named in code too, but not the convention that names them', () => {
    assert.deepEqual(
      forbiddenPhrases(note('Vive en `STG-LAYOUT`. Convención: `STG-<TEMA>`.')).map(({ phrase }) => phrase),
      ['STG-… (rama)'],
    );
  });

  it('catches branches, pull requests and doubts', () => {
    const text = note('En la rama STG-BASE, PR #28. Quizá. Tal vez. Sin verificar. Por confirmar.');
    assert.deepEqual(
      forbiddenPhrases(text).map(({ phrase }) => phrase),
      ['en la rama', 'STG-… (rama)', 'PR #', 'quizá', 'tal vez', 'sin verificar', 'por confirmar'],
    );
  });

  it('lets the pending note say «pendiente», and nobody else', () => {
    const text = note('Un pendiente de backend (pendiente, CTO).');
    assert.equal(forbiddenPhrases(text).length, 2);
    assert.equal(forbiddenPhrases(text, { pendingNote: true }).length, 0);
  });

  it('fails while 99-Archivo exists: the history lives in git', () => {
    const root = vault({ '99-Archivo/Vieja.md': note('texto') });
    assert.ok(problems(root, 'wording').some((problem) => problem.startsWith('99-Archivo/ exists')));
  });

  it('does not read an open prompt: it quotes the phrases it forbids', () => {
    const root = vault({ '07-Recursos/Prompts/prompt-x.md': note('antes, ya no, quizá') });
    assert.deepEqual(problems(root, 'wording'), []);
  });
});

describe('frontmatter', () => {
  const rules = frontmatterRules(CLAUDE);

  it('reads fields and values from the yaml block of CLAUDE.md, and the statuses of its table', () => {
    assert.deepEqual(rules.fields, ['type', 'title', 'status', 'created', 'updated', 'tags', 'related']);
    assert.ok(rules.types.has('adr'));
    assert.ok(rules.statuses.has('listo'));
    assert.ok(!rules.statuses.has('archived'));
  });

  it('rejects a missing field, a type or status CLAUDE.md does not list, and a bad date', () => {
    assert.deepEqual(frontmatterProblems('sin frontmatter', rules), ['no frontmatter']);
    assert.deepEqual(frontmatterProblems(note('x', { status: 'archived', updated: 'ayer' }), rules), [
      'status `archived` is not one of CLAUDE.md',
      'updated `ayer` is not AAAA-MM-DD',
    ]);
    assert.deepEqual(frontmatterProblems('---\ntype: meta\n---\n', rules).slice(0, 2), [
      'missing `title`',
      'missing `status`',
    ]);
  });

  it('asks an ADR for its decision status', () => {
    assert.deepEqual(frontmatterProblems(note('x', { type: 'adr' }), rules), [
      'decision_status `` is not aceptada or propuesta',
    ]);
    assert.deepEqual(frontmatterProblems(note('x', { type: 'adr', decision_status: 'aceptada' }), rules), []);
  });
});

describe('references from the code', () => {
  const names = new Map(
    [
      ['02-Arquitectura/Integracion Continua.md', 'integracion continua'],
      ['08/Componentes/Tabla.md', 'tabla'],
      ['08/Componentes/Navegacion.md', 'navegacion'],
      ['08/Nomenclatura de Componentes y Tokens.md', 'nomenclatura de componentes y tokens'],
      ['02-Arquitectura/Decisiones/0018 - Ramas y versiones.md', 'adr 0018'],
      ['08-Sistema-de-Diseno/i18n.md', '08-sistema-de-diseno/i18n'],
      ['08/Showroom - Especificacion.md', 'showroom - especificacion'],
      ['04/REQ-FE-DS4-002 - Favoritos.md', 'req-fe-ds4-002'],
    ].map(([file, name]) => [name, file]),
  );
  const parse = (text) => parseReference(text, names);

  it('reads notes, sections and headings, however the comment writes them', () => {
    assert.deepEqual(parse('Integracion Continua §4.1 y §11'), [
      { note: '02-Arquitectura/Integracion Continua.md', sections: ['4.1', '11'], headings: [] },
    ]);
    assert.deepEqual(parse('Nomenclatura de Componentes y Tokens (tokens compuestos)'), [
      { note: '08/Nomenclatura de Componentes y Tokens.md', sections: [], headings: ['tokens compuestos'] },
    ]);
    assert.deepEqual(
      parse('ADR 0018 y 08-Sistema-de-Diseno/i18n').map(({ note }) => note),
      ['02-Arquitectura/Decisiones/0018 - Ramas y versiones.md', '08-Sistema-de-Diseno/i18n.md'],
    );
    assert.deepEqual(parse('Showroom - Especificacion §3, 2026-09-17'), [
      { note: '08/Showroom - Especificacion.md', sections: ['3'], headings: [] },
    ]);
    assert.deepEqual(parse('REQ-FE-DS4-002 (v1.2)')[0].headings, []);
    assert.deepEqual(parse('Navegacion (móvil)')[0].headings, ['móvil']);
  });

  it('reports what is not a note', () => {
    assert.deepEqual(parse('IC §8'), [{ unresolved: 'IC §8' }]);
  });

  it('follows a reference across comment lines and string pieces, and stops at the sentence', () => {
    const block = '/**\n * Algo. Ver vault:\n * Integracion Continua §11. Y sigue.\n */';
    assert.equal(referenceText(block, block.indexOf('Ver vault:') + 10), 'Integracion Continua §11');
    const split = "'… Ver vault: ' +\n      '02-Arquitectura/Integracion Continua.md',";
    assert.equal(referenceText(split, split.indexOf('Ver vault:') + 11), '02-Arquitectura/Integracion Continua.md');
    const html = '<!-- Toggle). Ver vault: Tabla (9. Sangría y anchos). Más -->';
    assert.equal(referenceText(html, html.indexOf('Ver vault:') + 11), 'Tabla (9. Sangría y anchos)');
  });

  it('ends an HTML comment at --> and at --!>, as the browser does', () => {
    const bang = '<!-- Ver vault: Tabla --!> <p>el texto de la página</p>';
    assert.equal(referenceText(bang, bang.indexOf('Ver vault:') + 11), 'Tabla');
  });

  it('reads a section number as text, never as a pattern', () => {
    const noteText = '# Nota\n\n## 441 Otra sección\n';
    assert.equal(hasSection(noteText, '441'), true);
    assert.equal(hasSection(noteText, '4+1'), false);
  });
});

describe('tokens', () => {
  it('fails on a --color-* the note names and tokens.css does not define', () => {
    const root = vault({ 'Ficha.md': note('Usa `--color-text-primary` y `--color-inventado`.') });
    assert.deepEqual(problems(root, 'tokens'), ['Ficha.md:11 --color-inventado is not defined in tokens.css']);
  });
});
