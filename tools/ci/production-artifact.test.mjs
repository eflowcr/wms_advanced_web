/**
 * Desarrollo y producción hablan con la API real: el simulador, la franja y sus textos entran solo
 * al artefacto sintético de las E2E, por fileReplacements y el scope `demo` (ADR 0022).
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BROWSER = path.join(ROOT, 'dist/shell/browser');
const DEMO_DICTIONARIES = path.join(ROOT, 'projects/shell/public/i18n/demo');

/** Los archivos de texto del artefacto, en todas sus carpetas: scripts, página y diccionarios. */
async function textFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(js|html|json)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** Los textos de la franja, en todos los idiomas: ninguno es texto de una pantalla real. */
async function demoTexts() {
  const texts = [];
  for (const name of await readdir(DEMO_DICTIONARIES)) {
    texts.push(...Object.values(JSON.parse(await readFile(path.join(DEMO_DICTIONARIES, name), 'utf8'))));
  }
  return texts;
}

/** Huellas propias del simulador y de la franja; ninguna es texto de una pantalla real. */
export const DEMO_MARKERS = [
  'simulated-',
  'urn:ewms:security',
  'urn:ewms:acr',
  'setSimulatedSession',
  'setSimulatedTaskRunning',
  'app-demo-context',
  'data-security-demo',
  'security.demo.',
  'i18n/demo/',
];

/** Las huellas que aparecen en un texto. */
export function demoMarkersIn(source) {
  return DEMO_MARKERS.filter((marker) => source.includes(marker));
}

test('finds a whole demo text, never a word inside a longer one', () => {
  const source = '{"access":"Consultar pantalla","reader":"Consulta"}';
  assert.equal(source.includes(JSON.stringify('Consulta')), true);
  assert.equal('{"access":"Consultar pantalla"}'.includes(JSON.stringify('Consulta')), false);
});

test('finds every marker in a chunk that carries the demo band', () => {
  const chunk = `t("app-demo-context");x("data-security-demo");y("security.demo.notice")`;
  assert.deepEqual(demoMarkersIn(chunk), ['app-demo-context', 'data-security-demo', 'security.demo.']);
  assert.deepEqual(demoMarkersIn('const ok = "app-home";'), []);
});

test('only the synthetic E2E configuration swaps in the simulator', async () => {
  const angular = JSON.parse(await readFile(path.join(ROOT, 'angular.json'), 'utf8'));
  const configurations = angular.projects.shell.architect.build.configurations;
  const swapping = Object.entries(configurations)
    .filter(([, config]) => (config.fileReplacements ?? []).length > 0)
    .map(([name]) => name);
  assert.deepEqual(swapping, ['e2e']);
  const serve = angular.projects.shell.architect.serve.configurations;
  assert.ok(Object.values(serve).every((config) => !config.buildTarget.endsWith(':e2e')));
});

test('the production build carries neither the simulator nor the demo band', async () => {
  assert.ok(existsSync(BROWSER), `${BROWSER} is missing: run npm run build first`);
  const files = (await readdir(BROWSER)).filter((name) => /\.(js|html)$/.test(name));
  assert.ok(files.length > 0, 'the build wrote no script');
  const found = [];
  for (const name of files) {
    const markers = demoMarkersIn(await readFile(path.join(BROWSER, name), 'utf8'));
    if (markers.length > 0) found.push(`${name}: ${markers.join(', ')}`);
  }
  assert.deepEqual(found, [], 'demo code reached the production artifact');
});

test('the production build carries no dictionary of the demo band, nor any of its texts', async () => {
  assert.ok(existsSync(BROWSER), `${BROWSER} is missing: run npm run build first`);
  assert.ok(!existsSync(path.join(BROWSER, 'i18n/demo')), 'the demo dictionaries were copied');
  const texts = await demoTexts();
  assert.ok(texts.length > 0, 'the demo dictionaries have no text');
  const found = [];
  for (const file of await textFiles(BROWSER)) {
    const source = await readFile(file, 'utf8');
    // La cadena completa, con sus comillas: «Consulta» no es «Consultar pantalla».
    const leaked = texts.filter((text) => source.includes(JSON.stringify(text)));
    if (leaked.length > 0) found.push(`${path.relative(BROWSER, file)}: ${leaked.join(' | ')}`);
  }
  assert.deepEqual(found, [], 'a text of the demo band reached the production artifact');
});
