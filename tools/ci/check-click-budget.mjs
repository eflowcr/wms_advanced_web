/**
 * HG-02 of REQ-FE-DS4-003: THE CLICK BUDGET IS NOT WRITTEN TWICE.
 *
 * The standard lives in the vault. `click-budget.ts` holds the one copy the
 * code is allowed, and both the example screen and the end-to-end test import
 * from it. This gate is what stops a third copy appearing, because a screen
 * and a test that agree with each other while both drift from the standard is
 * the exact failure the requirement is written to prevent.
 *
 * Two checks, from the two sides:
 *
 *   1. No consumer PRINTS a budget as a literal. That is how the screen would
 *      come to advertise a figure nothing verifies.
 *   2. The end-to-end test IMPORTS the constants. That is how the test would
 *      come to verify a figure the standard no longer says.
 *
 *
 * WHY A SOURCE SCAN AND NOT AN ASSERTION IN THE PAGE'S SPEC
 *
 * A rendered `2` looks the same whether it came from the constant or from the
 * template, so a unit test cannot tell the two apart. The page's own spec
 * asserts the half a DOM can answer -- that what is on screen equals what the
 * constants hold. This answers the other half.
 *
 * Run with `npm run lint:click-budget`, and asserted by
 * check-click-budget.test.mjs, which `npm test` runs.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The one file allowed to hold the numbers. */
export const BUDGET_FILE = 'projects/showroom/src/lib/pages/patterns/click-budget.ts';

/** Everything that consumes the budget and must therefore only read it. */
export const CONSUMERS = ['projects/showroom/src/lib/pages/patterns'];

/**
 * The end-to-end test, which must IMPORT the budgets rather than restate them.
 *
 * Checked by looking for the imported NAMES rather than by hunting for stray
 * digits: a test file is full of numbers that are not budgets -- how many
 * rows, which index, how long to wait -- and a rule broad enough to catch a
 * restated budget in there would catch all of those too, and be switched off
 * within a week. Proving it reads the constants is the claim that matters.
 *
 * It reaches them through `@ewms/showroom` and not by a relative path, because
 * the boundary rules are right to stop a test file from being the back door
 * into the architecture. Which spelling of the import is used does not matter
 * here; that the names arrive from somewhere else does.
 */
export const BUDGET_TEST = 'e2e/click-budget.e2e.ts';

/**
 * A budget PRINTED as a literal, which is the way it would actually happen:
 * somebody writes "Máximo 2" into a template because it is quicker than
 * reaching for the constant, and from then on the screen advertises a figure
 * nothing verifies.
 *
 * Prose that spells the figure in words ("dos clics") is not matched and is
 * not meant to be. It cannot drift silently -- nobody greps for a word and
 * changes it -- and a rule wide enough to catch it would catch every other
 * number in the page.
 */
const STATED_BUDGET = [{ pattern: /M[áa]ximo:?\s+\d/g, what: 'a budget printed as a literal' }];

export function statedBudgets(source) {
  const found = [];
  for (const { pattern, what } of STATED_BUDGET) {
    for (const match of source.matchAll(new RegExp(pattern))) {
      found.push({ index: match.index, text: match[0], what });
    }
  }
  return found;
}

/**
 * Whether this source imports the budget constants by name.
 *
 * At least three of the four, so that a test covering only some of the flows
 * still passes -- and so that adding a fifth flow to the standard does not
 * fail the gate before anybody has written its test.
 */
export function importsBudgets(source, names) {
  const imported = source.slice(0, source.indexOf('test.describe'));
  return names.filter((name) => imported.includes(name)).length >= 3;
}

export function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

async function listFiles(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(relative)));
    } else if (/\.(ts|html)$/.test(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

function error(file, line, message) {
  console.error(
    process.env.GITHUB_ACTIONS
      ? `::error file=${file},line=${line}::${message}`
      : `${file}:${line} ${message}`,
  );
}

async function main() {
  const budgetSource = await readFile(path.join(ROOT, BUDGET_FILE), 'utf8');
  const declared = [...budgetSource.matchAll(/export const (\w+_MAX_CLICKS) = (\d+);/g)];
  if (declared.length < 4) {
    console.error(
      `Click budget: ${BUDGET_FILE} declares ${declared.length} budget(s). ` +
        'The gate would pass vacuously -- the standard has four flows.',
    );
    process.exitCode = 1;
    return;
  }

  let violations = 0;
  let scanned = 0;
  for (const dir of CONSUMERS) {
    for (const file of await listFiles(dir)) {
      if (file === BUDGET_FILE) {
        continue;
      }
      scanned += 1;
      const source = await readFile(path.join(ROOT, file), 'utf8');
      for (const finding of statedBudgets(source)) {
        error(
          file,
          lineOf(source, finding.index),
          `${finding.what}: \`${finding.text}\`. The four budgets live in ${BUDGET_FILE}, ` +
            'which the screen and the test both import (REQ-FE-DS4-003 HG-02). ' +
            'Read the constant instead of restating the number.',
        );
        violations += 1;
      }
    }
  }

  /*
   * And the test reads them. Without this the gate would pass over a test that
   * asserted a hand-typed 2, which is the same drift seen from the other side.
   */
  let testSource = '';
  try {
    testSource = await readFile(path.join(ROOT, BUDGET_TEST), 'utf8');
  } catch {
    error(BUDGET_TEST, 0, 'is missing. The budgets are advertised and nothing verifies them.');
    violations += 1;
  }
  if (
    testSource !== '' &&
    !importsBudgets(
      testSource,
      declared.map(([, name]) => name),
    )
  ) {
    error(
      BUDGET_TEST,
      0,
      `does not import the budgets declared in ${BUDGET_FILE}. A test that types ` +
        'the number in agrees with itself, not with the standard (REQ-FE-DS4-003 HG-02).',
    );
    violations += 1;
  }

  if (violations > 0) {
    console.error('\nClick budget: gate failed. See REQ-FE-DS4-003 §2.2 and HG-02.');
    process.exitCode = 1;
    return;
  }
  console.log(
    `Click budget: ${declared.length} budget(s) declared once, in ${BUDGET_FILE}; ` +
      `${scanned} consumer file(s) and ${BUDGET_TEST} read them rather than restating them.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((reason) => {
    console.error(reason instanceof Error ? reason.message : reason);
    process.exitCode = 1;
  });
}
