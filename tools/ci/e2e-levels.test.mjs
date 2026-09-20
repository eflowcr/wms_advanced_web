/**
 * THE PATH FILTER OF GATE 4b, EXERCISED RATHER THAN TRUSTED.
 *
 * `ci.yml` decides whether the `showroom` end-to-end suite runs on a pull
 * request by matching the changed files against one extended regular
 * expression. A filter that is wrong in the permissive direction only wastes
 * minutes; one that is wrong in the other direction lets a change to the
 * design system through without the suite that documents it, which is the
 * failure worth a test.
 *
 * THE PATTERN IS READ OUT OF THE WORKFLOW, not copied here. A copy would agree
 * with itself the day somebody edits the workflow, which is the same mistake
 * `check-click-budget.mjs` exists to prevent one floor down.
 *
 * Run with `npm run test:tools`.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');

/** The one `grep -Eq '<pattern>'` line of the `changes` job. */
async function showroomFilter() {
  const workflow = await readFile(WORKFLOW, 'utf8');
  const match = workflow.match(/grep -Eq '([^']+)'/);
  assert.ok(match, 'ci.yml no declara el filtro de rutas con grep -Eq');
  // The workflow is YAML inside a shell block: `\.` and `\n` survive as
  // written, so the pattern reaches JavaScript exactly as grep sees it.
  return new RegExp(match[1]);
}

/** What the `changes` job answers for one list of changed files. */
function runsShowroom(filter, changed) {
  return changed.some((file) => filter.test(file));
}

test('the showroom suite runs when what it documents changed', async () => {
  const filter = await showroomFilter();

  for (const file of [
    'projects/design-system/src/lib/button/button.ts',
    'projects/showroom/src/lib/catalog.ts',
    'projects/shell/src/app/layout/main-layout.html',
    'e2e/showroom.e2e.ts',
    'playwright.config.ts',
  ]) {
    assert.equal(runsShowroom(filter, [file]), true, `${file} debería disparar showroom`);
  }
});

test('and does not run for a change it does not document', async () => {
  const filter = await showroomFilter();

  for (const file of [
    'projects/core/src/lib/i18n/icu.ts',
    'projects/api-client/src/public-api.ts',
    'projects/shell/src/app/pages/home.ts',
    'tools/ci/check-i18n.mjs',
    'README.md',
  ]) {
    assert.equal(runsShowroom(filter, [file]), false, `${file} no debería disparar showroom`);
  }
});

test('one matching file in a long list is enough', async () => {
  const filter = await showroomFilter();

  assert.equal(
    runsShowroom(filter, [
      'README.md',
      'projects/core/src/lib/i18n/icu.ts',
      'projects/design-system/src/styles/tokens.css',
    ]),
    true,
  );
});

test('the three levels exist in the Playwright configuration', async () => {
  const config = await readFile(path.join(ROOT, 'playwright.config.ts'), 'utf8');

  for (const level of ['smoke', 'showroom', 'domain']) {
    assert.match(config, new RegExp(`name: '${level}'`), `falta el proyecto ${level}`);
  }
  // The number that forced the split: one worker is what it must never be again.
  assert.match(config, /workers: CI \? 4 : undefined/);
});
