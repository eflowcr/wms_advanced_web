/**
 * Tests for the click-budget scan, AND the scan itself over this repository.
 *
 * Same shape and same reason as check-shortcuts.test.mjs: the unit cases pin
 * down what the rule does, and running the real scan here keeps it inside
 * `npm test`, which is already blocking, without adding a ninth CI step.
 *
 * Plain node:test, no Angular. Run with `npm run test:tools` (part of `npm test`).
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  BUDGET_FILE,
  BUDGET_TEST,
  importsBudgets,
  lineOf,
  statedBudgets,
} from './check-click-budget.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const run = promisify(execFile);

describe('statedBudgets', () => {
  it('flags a budget typed into a template', () => {
    const found = statedBudgets('<td>Máximo 3 clics</td>');
    assert.equal(found.length, 1);
  });

  it('flags it with or without the accent, and with a colon', () => {
    assert.equal(statedBudgets('Maximo 2').length, 1);
    assert.equal(statedBudgets('Máximo: 2').length, 1);
  });

  it('leaves a budget that is READ alone', () => {
    // What the screen actually does. The digit never appears in the source.
    assert.deepEqual(statedBudgets("Máximo {{ budgetFor('edit') }}."), []);
    assert.deepEqual(statedBudgets('<td>{{ budget.max }}</td>'), []);
  });

  it('leaves prose that spells the figure in words alone', () => {
    /*
     * Deliberate. A word cannot drift silently -- nobody greps for "dos" and
     * changes it -- and a rule wide enough to catch it would catch every other
     * number on the page and be switched off within a week.
     */
    assert.deepEqual(statedBudgets('Buscar no debería costar más de dos clics.'), []);
  });

  it('reports the line, so the error points somewhere', () => {
    const source = 'a\n\nMáximo 2\n';
    const [found] = statedBudgets(source);
    assert.equal(lineOf(source, found.index), 3);
  });
});

describe('importsBudgets', () => {
  const NAMES = ['SEARCH_MAX_CLICKS', 'CREATE_MAX_CLICKS', 'EDIT_MAX_CLICKS', 'CANCEL_MAX_CLICKS'];

  it('accepts a test that pulls the names in from somewhere else', () => {
    const source = [
      "import { SEARCH_MAX_CLICKS, CREATE_MAX_CLICKS, EDIT_MAX_CLICKS } from '@ewms/showroom';",
      "test.describe('x', () => {});",
    ].join('\n');
    assert.equal(importsBudgets(source, NAMES), true);
  });

  it('rejects a test that declares its own', () => {
    const source = [
      'const SEARCH_MAX_CLICKS = 2;',
      "test.describe('x', () => { expect(n).toBe(2); });",
    ].join('\n');
    // One name, and it is its own. Two short of the three the rule asks for.
    assert.equal(importsBudgets(source, NAMES), false);
  });
});

describe('the repository itself', () => {
  it('declares the four budgets once, and nobody restates them', async () => {
    const { stdout } = await run(process.execPath, [path.join(HERE, 'check-click-budget.mjs')], {
      cwd: ROOT,
    });

    assert.match(stdout, /budget\(s\) declared once/);
    assert.match(stdout, /read them rather than restating them/);
  });

  it('the file it trusts really holds the numbers', async () => {
    // Otherwise the scan passes because it found nothing to look for.
    //
    // FIVE SINCE DS-5. «Abrir un favorito · 1» joined the four of DS-4 the day
    // favourites were built, and it is the one budget that is not about a
    // single screen: the star is in the App Shell's header and the block is in
    // its rail, so the flow crosses the application. REQ-FE-DS4-003 §2.2 owns
    // the figure, as it owns the other four.
    const source = await readFile(path.join(ROOT, BUDGET_FILE), 'utf8');
    const declared = [...source.matchAll(/export const (\w+_MAX_CLICKS) = (\d+);/g)].map(
      ([, name]) => name,
    );

    assert.deepEqual(declared.sort(), [
      'CANCEL_MAX_CLICKS',
      'CREATE_MAX_CLICKS',
      'EDIT_MAX_CLICKS',
      'OPEN_FAVORITE_MAX_CLICKS',
      'SEARCH_MAX_CLICKS',
    ]);
  });

  it('the end-to-end test imports them rather than typing them in', async () => {
    const source = await readFile(path.join(ROOT, BUDGET_TEST), 'utf8');
    for (const name of [
      'SEARCH_MAX_CLICKS',
      'CREATE_MAX_CLICKS',
      'EDIT_MAX_CLICKS',
      'OPEN_FAVORITE_MAX_CLICKS',
    ]) {
      assert.ok(source.includes(name), `${BUDGET_TEST} never uses ${name}`);
    }
  });
});
