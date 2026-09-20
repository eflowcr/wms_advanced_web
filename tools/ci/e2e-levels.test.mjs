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

/**
 * THE FOUR REQUIRED CHECKS, BY NAME.
 *
 * The branch rule on `development` requires checks by name, letter for
 * letter, and GitHub takes the name from a job's `name:`. A required check
 * nobody reports does not fail -- it waits forever, and the pull request is
 * blocked with nothing red to look at (3dab2a3). This is the guard that a
 * comment in the workflow cannot be.
 */
const REQUIRED_CHECKS = ['verify', 'smoke', 'showroom', 'secrets'];

/** Every job's visible name: the `name:` lines at job level (four spaces). */
async function jobNames() {
  const workflow = await readFile(WORKFLOW, 'utf8');
  return [...workflow.matchAll(/^ {4}name: (.+)$/gm)].map((match) => match[1].trim());
}

test('the four required checks exist, named exactly', async () => {
  const names = await jobNames();

  for (const check of REQUIRED_CHECKS) {
    assert.equal(
      names.filter((name) => name === check).length,
      1,
      `ci.yml debe tener exactamente un job llamado «${check}»; hay: ${names.join(' | ')}`,
    );
  }
});

test('the check called `showroom` always reports, so it can be required', async () => {
  const workflow = await readFile(WORKFLOW, 'utf8');
  const job = workflow.match(/^ {2}showroom:\n(?:(?: {4}.*)?\n)+/m);

  assert.ok(job, 'ci.yml no declara el job `showroom`');
  assert.match(job[0], /^ {4}name: showroom$/m);
  // A job with a conditional `if:` is SKIPPED when it is false, and a skipped
  // required check is not a passing one to GitHub.
  assert.match(job[0], /^ {4}if: \$\{\{ always\(\) \}\}$/m);
});

test('no name in the workflow carries a rule number', async () => {
  // The numbers live in the vault, where a rule can be cited. Here they made
  // renumbering a rule the same thing as renaming a required check.
  const workflow = await readFile(WORKFLOW, 'utf8');
  const numbered = [...workflow.matchAll(/^\s*(?:- )?name: .*\bGate\b.*$/gim)].map((m) =>
    m[0].trim(),
  );

  assert.deepEqual(numbered, []);
});

test('the workflow limits the GITHUB_TOKEN to reading, once, for every job', async () => {
  // CodeQL (actions/missing-workflow-permissions) reports every job of a
  // workflow that does not say. Declared at the top, so a job added later is
  // covered without anybody remembering to.
  const workflow = await readFile(WORKFLOW, 'utf8');

  assert.match(workflow, /^permissions:\r?\n {2}contents: read\r?$/m);
});
