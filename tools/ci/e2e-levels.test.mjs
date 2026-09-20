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
 * THE JOB NAMES THE RULESET ALREADY REQUIRES, COPIED LETTER FOR LETTER.
 *
 * The ruleset «Protect» requires checks by name, and GitHub takes the name
 * from a job's `name:`. A required check nobody reports does not fail -- it
 * waits forever, and the pull request is blocked with nothing red to look at.
 * It happened twice: 3dab2a3, and again on the DS-5 closing PR.
 *
 * THESE ARE INPUTS, NOT CHOICES. The ruleset lives in GitHub and editing it
 * needs admin rights this team does not have (checked 2026-09-20: `push`, no
 * `admin`). Renaming a job here does not rename the requirement; it orphans
 * it. So this list is what GitHub asks for, and the test exists to make a
 * well-meant rename fail HERE -- inside `verify`, on the pull request -- and
 * not as a merge button nobody can press.
 *
 * Read from the ruleset on 2026-09-20 (three of ci.yml's; `Analyze (actions)`
 * and `Analyze (javascript-typescript)` are codeql.yml's and are not listed).
 */
const REQUIRED_JOB_NAMES = {
  verify: 'Types, lint, tests, budgets',
  smoke: 'Playwright smoke',
  secrets: 'Gitleaks',
};

/** The block of one job, from its id to the next job at the same indent. */
async function job(id) {
  const workflow = await readFile(WORKFLOW, 'utf8');
  const block = workflow.match(new RegExp(`^ {2}${id}:\\r?\\n(?:(?: {3,}.*)?\\r?\\n)+`, 'm'));
  assert.ok(block, `ci.yml no declara el job \`${id}\``);
  return block[0];
}

test('every job the ruleset requires is named exactly as the ruleset asks', async () => {
  for (const [id, name] of Object.entries(REQUIRED_JOB_NAMES)) {
    assert.match(
      await job(id),
      new RegExp(`^ {4}name: ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?$`, 'm'),
      `el job \`${id}\` debe llamarse «${name}», que es lo que exige el ruleset`,
    );
  }
});

test('the showroom verdict always reports, so it can be required one day', async () => {
  const block = await job('showroom');

  // The one name that is ours: the ruleset does not ask for it yet.
  assert.match(block, /^ {4}name: Playwright showroom\r?$/m);

  /*
   * IT REPORTS BECAUSE IT ALWAYS RUNS, which is stronger than the `always()`
   * this test used to demand. `always()` was needed while the job read three
   * sharded jobs through `needs:`; a job that depends on nothing and carries
   * no `if:` of its own cannot be skipped at all, and a skipped required
   * check is not a passing one to GitHub.
   *
   * The path filter lives in a STEP now, so the steps below it skip and the
   * job still reports.
   */
  assert.doesNotMatch(block, /^ {4}needs:/m, 'el veredicto del showroom no depende de otro job');
  assert.doesNotMatch(block, /^ {4}if:/m, 'un job con `if:` se SALTA, y un check saltado no pasa');
});

test('the showroom suite runs on one machine, and the measurement is why', async () => {
  // WHAT THE WORKFLOW DOES, NOT WHAT IT SAYS: the comment right below this
  // job names `merge-reports` to explain why it is gone, and a raw match on
  // the file would read that explanation as the thing it forbids.
  const workflow = (await readFile(WORKFLOW, 'utf8'))
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  /*
   * Measured 2026-09-20 at four workers: the whole project in one run takes
   * 2 min 18 s, and the same tests split three ways take 3 min 38 s of
   * machine time -- 58% more work for 48 s of wall clock, which CI then
   * spends twice over installing Node, the dependencies and the browser on
   * two extra runners (~40 s each).
   */
  assert.doesNotMatch(
    workflow,
    /--shard=/,
    'el sharding se midio y no paga: ver Integracion Continua.md',
  );
  assert.doesNotMatch(workflow, /merge-reports/, 'una sola corrida escribe un solo reporte');
  assert.doesNotMatch(workflow, /^ {2}showroom-/m, 'un veredicto, un job');
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
