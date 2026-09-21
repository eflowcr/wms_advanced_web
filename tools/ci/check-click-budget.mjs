/**
 * REQ-FE-DS4-003 HG-02: el presupuesto de clics no se escribe dos veces.
 *
 * `click-budget.ts` guarda la única copia del estándar del vault que el código puede
 * tener, y la pantalla de ejemplo y la prueba e2e la importan. Dos controles: ningún
 * consumidor imprime un presupuesto como literal, y la prueba e2e importa las constantes.
 * Es un escaneo de fuente porque un `2` renderizado es idéntico venga de la constante o
 * de la plantilla; la spec de la página cubre la mitad que el DOM sí puede responder.
 *
 * `npm run lint:click-budget`; lo afirma check-click-budget.test.mjs.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** El único archivo que puede tener los números. */
export const BUDGET_FILE = 'projects/showroom/src/lib/pages/patterns/click-budget.ts';

/** Lo que consume el presupuesto y por eso solo puede leerlo. */
export const CONSUMERS = ['projects/showroom/src/lib/pages/patterns'];

/**
 * La prueba e2e. Se buscan los nombres importados y no dígitos sueltos: una prueba está
 * llena de números que no son presupuestos, y una regla que los atrapara se apagaría en
 * una semana. Llega por `@ewms/showroom`, no por ruta relativa: lo exigen las fronteras.
 */
export const BUDGET_TEST = 'e2e/click-budget.e2e.ts';

/**
 * Un presupuesto impreso como literal («Máximo 2» en una plantilla). La prosa con la
 * cifra en palabras («dos clics») no se atrapa a propósito: no deriva en silencio, y una
 * regla tan amplia atraparía todo otro número de la página.
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
 * Si la fuente importa las constantes por nombre. Alcanza con tres de las cuatro: una
 * prueba que cubra parte de los flujos pasa, y un quinto flujo no rompe antes de su prueba.
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

  // Y la prueba las lee: si no, pasaría una prueba que afirma un 2 tipeado a mano.
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
