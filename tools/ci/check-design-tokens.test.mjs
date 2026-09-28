import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classCandidates,
  primitiveTokenMatches,
  rawLayerMatches,
  rawLengthMatches,
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

describe('rawLengthMatches', () => {
  const lengths = (content, extension = '.html') =>
    rawLengthMatches(content, extension).map(({ length }) => length);

  it('rejects rem, em, vh, vw, ch and px inside an arbitrary utility, minmax() and calc() too', () => {
    const grid = 'grid-cols-[repeat(auto-fit,minmax(min(20rem,100%),1fr))]';
    assert.deepEqual(lengths(`<div class="grid ${grid} gap-4"></div>`), ['20rem']);
    assert.deepEqual(lengths('<div class="w-[calc(100%-2rem)] max-w-[24rem]"></div>'), ['2rem', '24rem']);
    assert.deepEqual(lengths('<p class="h-[50vh] w-[10vw] p-[1.5em] max-w-[60ch] top-[3px]"></p>'), [
      '50vh',
      '10vw',
      '1.5em',
      '60ch',
      '3px',
    ]);
  });

  it('finds them in a TypeScript literal and behind a variant', () => {
    assert.deepEqual(lengths("const grid = 'md:grid-cols-[minmax(8rem,1fr)_auto]';", '.ts'), ['8rem']);
  });

  it('accepts a token, a percentage, a fraction, a bare number and a length outside a class', () => {
    assert.deepEqual(
      lengths(
        '<div class="grid-cols-[repeat(auto-fit,minmax(min(var(--grid-min),100%),1fr))] w-(--nav-rail-width)' +
          ' [backdrop-filter:var(--backdrop)] basis-[50%] grid-cols-[1fr_2fr] leading-[1.5]">prosa de 20rem</div>',
      ),
      [],
    );
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
