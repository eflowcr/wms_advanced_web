/**
 * El filtro por rutas del job showroom, ejercitado en vez de confiado. Un filtro
 * permisivo de más solo gasta minutos; uno estricto de más deja pasar un cambio del
 * sistema de diseño sin la suite que lo documenta, y ese es el fallo que merece prueba.
 * La expresión se lee de `ci.yml`, no se copia: una copia coincidiría consigo misma.
 *
 * `npm run test:tools`.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');

/** La única línea `grep -Eq '<patrón>'` del paso de filtro. */
async function showroomFilter() {
  const workflow = await readFile(WORKFLOW, 'utf8');
  const match = workflow.match(/grep -Eq '([^']+)'/);
  assert.ok(match, 'ci.yml no declara el filtro de rutas con grep -Eq');
  // Es YAML dentro de un bloque de shell: `\.` y `\n` sobreviven tal cual, así que el
  // patrón llega a JavaScript exactamente como lo ve grep.
  return new RegExp(match[1]);
}

/** Lo que responde el filtro para una lista de archivos cambiados. */
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
  // El número que forzó los niveles: un worker es lo que nunca debe volver a ser.
  assert.match(config, /workers: CI \? 4 : undefined/);
});

/**
 * Los nombres de job que el ruleset «Protect» ya exige, copiados letra por letra. Son
 * entradas, no decisiones: el ruleset vive en GitHub y editarlo pide admin (comprobado
 * 2026-09-20). Un check exigido que nadie reporta no falla: espera para siempre (pasó
 * en 3dab2a3 y en el cierre de DS-5). Esta prueba hace fallar un renombrado acá, en la
 * PR. Los `Analyze (...)` son de codeql.yml. Ver vault: Integracion Continua.md §4.
 */
const REQUIRED_JOB_NAMES = {
  verify: 'Types, lint, tests, budgets',
  smoke: 'Playwright smoke',
  secrets: 'Gitleaks',
};

/** El bloque de un job, desde su id hasta el siguiente job con la misma sangría. */
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

  // El único nombre nuestro: el ruleset todavía no lo pide.
  assert.match(block, /^ {4}name: Playwright showroom\r?$/m);

  // Reporta porque siempre corre, que es más fuerte que el `always()` de antes: un job
  // sin `needs:` ni `if:` no se puede saltar, y un check saltado no pasa para GitHub.
  // El filtro vive en un paso: se saltan los pasos de abajo y el job reporta igual.
  assert.doesNotMatch(block, /^ {4}needs:/m, 'el veredicto del showroom no depende de otro job');
  assert.doesNotMatch(block, /^ {4}if:/m, 'un job con `if:` se SALTA, y un check saltado no pasa');
});

test('the showroom suite runs on one machine, and the measurement is why', async () => {
  // Lo que hace el workflow, no lo que dice: un comentario nombra `merge-reports` para
  // explicar por qué ya no está, y buscar en el archivo crudo lo leería como uso.
  const workflow = (await readFile(WORKFLOW, 'utf8'))
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');

  // Medido 2026-09-20 con cuatro workers: una corrida, 2 min 18 s; en tres shards,
  // 3 min 38 s de máquina (58 % más por 48 s de reloj), más ~40 s de instalación por
  // runner extra. Ver vault: Integracion Continua.md, «El sharding se midio y no paga».
  assert.doesNotMatch(
    workflow,
    /--shard=/,
    'el sharding se midio y no paga: ver Integracion Continua.md',
  );
  assert.doesNotMatch(workflow, /merge-reports/, 'una sola corrida escribe un solo reporte');
  assert.doesNotMatch(workflow, /^ {2}showroom-/m, 'un veredicto, un job');
});

test('no name in the workflow carries a rule number', async () => {
  // Los números de regla viven en el vault, donde se pueden citar. Acá renumerar una
  // regla era lo mismo que renombrar un check exigido.
  const workflow = await readFile(WORKFLOW, 'utf8');
  const numbered = [...workflow.matchAll(/^\s*(?:- )?name: .*\bGate\b.*$/gim)].map((m) =>
    m[0].trim(),
  );

  assert.deepEqual(numbered, []);
});

test('the workflow limits the GITHUB_TOKEN to reading, once, for every job', async () => {
  // CodeQL (actions/missing-workflow-permissions) reporta cada job de un workflow que
  // no lo declara. Arriba de todo, cubre también el job que se agregue después.
  const workflow = await readFile(WORKFLOW, 'utf8');

  assert.match(workflow, /^permissions:\r?\n {2}contents: read\r?$/m);
});
