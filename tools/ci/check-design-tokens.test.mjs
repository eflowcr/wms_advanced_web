import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classCandidates, primitiveTokenMatches, rawValueMatches } from './check-design-tokens.mjs';

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

describe('primitiveTokenMatches', () => {
  it('matches primitive names by exact equality', () => {
    assert.deepEqual(primitiveTokenMatches('--navy-9 --navy-95 --navy-9x', ['--navy-9', '--navy-95']), [
      { value: '--navy-9', index: 0 },
      { value: '--navy-95', index: 9 },
    ]);
  });
});
