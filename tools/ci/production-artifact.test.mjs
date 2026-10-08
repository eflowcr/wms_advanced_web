/**
 * El artefacto de producción no lleva el simulador del Security Core ni la franja de
 * demostración: los dos entran solo por fileReplacements (ADR 0022). Sin dist/ falla.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BROWSER = path.join(ROOT, 'dist/shell/browser');

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
];

/** Las huellas que aparecen en un texto. */
export function demoMarkersIn(source) {
  return DEMO_MARKERS.filter((marker) => source.includes(marker));
}

test('finds every marker in a chunk that carries the demo band', () => {
  const chunk = `t("app-demo-context");x("data-security-demo");y("security.demo.notice")`;
  assert.deepEqual(demoMarkersIn(chunk), ['app-demo-context', 'data-security-demo', 'security.demo.']);
  assert.deepEqual(demoMarkersIn('const ok = "app-home";'), []);
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
