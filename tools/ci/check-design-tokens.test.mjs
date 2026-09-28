import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classCandidates,
  primitiveTokenMatches,
  rawLayerMatches,
  rawValueMatches,
} from './check-design-tokens.mjs';

describe('classCandidates', () => {
  it('finds utilities in class attributes and class bindings, not prose or code text', () => {
    const found = classCandidates(
      '<div class="bg-blue-500">prose bg-red-500</div><code>bg-green-500</code>' +
        '<span [class.bg-yellow-500]="ok" [class]="\'text-red-500\'" [ngClass]="classes"></span>',
      '.html',
    );

    assert.ok(found.includes('bg-blue-500'));
    assert.ok(found.includes('bg-yellow-500'));
    assert.ok(found.includes('text-red-500'));
    assert.equal(found.includes('bg-red-500'), false);
    assert.equal(found.includes('bg-green-500'), false);
  });

  it('finds utilities in TypeScript literals and CSS @apply', () => {
    assert.deepEqual(classCandidates("const value = 'bg-blue-500';", '.ts'), ['bg-blue-500']);
    assert.deepEqual(classCandidates('.thing { @apply text-red-500; }', '.css'), ['text-red-500']);
  });

  it('finishes quickly on the former ReDoS input', () => {
    const hostile = '<A !=' + '"" !='.repeat(40);
    const started = performance.now();
    classCandidates(hostile, '.html');
    assert.ok(performance.now() - started < 1000);
  });
});

describe('rawValueMatches', () => {
  it('finds a loose hex outside tokens.css', () => {
    assert.deepEqual(rawValueMatches('color: #abc123;', '.component.css'), [
      { value: '#abc123', label: 'hex colour', index: 7 },
    ]);
  });
});

// Las clases se arman por partes: Tailwind escanea este archivo y una capa escrita entera
// emitiría su CSS en la hoja de la app.
describe('rawLayerMatches', () => {
  const z = (value) => `z-${value}`;

  it('rejects a numbered layer in a class attribute, negative or arbitrary', () => {
    assert.deepEqual(rawLayerMatches(`<div class="sticky ${z(10)}"></div>`, '.html'), [z(10)]);
    assert.deepEqual(rawLayerMatches(`<div class="-${z(1)}"></div>`, '.html'), [`-${z(1)}`]);
    assert.deepEqual(rawLayerMatches(`<div class="${z('[5]')}"></div>`, '.html'), [z('[5]')]);
  });

  it('rejects it behind a variant and in a class binding', () => {
    assert.deepEqual(rawLayerMatches(`<a class="focus:${z(10)}"></a>`, '.html'), [`focus:${z(10)}`]);
    assert.deepEqual(rawLayerMatches(`<i class="before:${z(4)}"></i>`, '.html'), [`before:${z(4)}`]);
    assert.deepEqual(rawLayerMatches(`<p [class.${z(10)}]="open"></p>`, '.html'), [z(10)]);
  });

  it('rejects it in a TypeScript literal, and not in template prose', () => {
    assert.deepEqual(rawLayerMatches(`const pin = 'sticky ${z(3)}';`, '.ts'), [z(3)]);
    assert.deepEqual(rawLayerMatches(`<p>la capa ${z(3)}</p>`, '.html'), []);
  });

  it('accepts a layer token and auto', () => {
    assert.deepEqual(rawLayerMatches(`<div class="${z('(--layer-shell)')} ${z('auto')}"></div>`, '.html'), []);
    assert.deepEqual(rawLayerMatches(`const top = 'focus:${z('(--layer-skip-link)')}';`, '.ts'), []);
  });
});

describe('primitiveTokenMatches', () => {
  it('matches primitive names by exact equality', () => {
    assert.deepEqual(primitiveTokenMatches('--navy-9 --navy-95 --navy-9x', ['--navy-9', '--navy-95']), [
      { value: '--navy-9', index: 0 },
      { value: '--navy-95', index: 9 },
    ]);
  });
});
