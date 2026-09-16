/**
 * Tests for the vault token-name comparison (a manual tool, not a CI gate).
 *
 * Plain node:test. Run with `npm run test:tools` (part of `npm test`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { citedColorTokens, definedColorTokens } from './check-token-names.mjs';

const names = (markdown) => citedColorTokens(markdown).map(({ name }) => name);

describe('definedColorTokens', () => {
  it('reads the --color-* definitions and ignores primitives and uses', () => {
    const css = ':root {\n  --navy-7: #010f42;\n  --color-text-primary: var(--navy-7);\n}';
    assert.deepEqual([...definedColorTokens(css)], ['--color-text-primary']);
  });
});

describe('citedColorTokens', () => {
  it('finds whole names with their line', () => {
    assert.deepEqual(citedColorTokens('| a |\n| `--color-border-strong` | borde |'), [
      { name: '--color-border-strong', line: 2 },
    ]);
  });

  it('ignores Tailwind theme variables, wildcards and placeholders', () => {
    assert.deepEqual(
      names('`--background-color-primary`, `--color-neutral-*`, `--color-<familia>-solid`'),
      [],
    );
  });

  it('keeps an inverted name so it can be reported', () => {
    assert.deepEqual(names('hint en `--color-text-danger`'), ['--color-text-danger']);
  });
});
