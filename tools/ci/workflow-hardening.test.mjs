// Los workflows, endurecidos y guardados: actions por SHA, un tope por job, gitleaks verificado antes
// de instalarlo y Node exacto en un solo archivo. Ver vault: 02-Arquitectura/Integracion Continua.md §4.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOWS = ['ci.yml', 'codeql.yml'];

/** El workflow sin sus comentarios: un comentario que nombra algo no es usarlo. */
async function workflow(name) {
  const text = await readFile(path.join(ROOT, '.github', 'workflows', name), 'utf8');
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

/** Los ids de los jobs: las claves con dos espacios de sangría bajo `jobs:`. */
function jobIds(text) {
  const jobs = text.slice(text.indexOf('\njobs:'));
  return [...jobs.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)].map(([, id]) => id);
}

/** El bloque de un job, hasta el siguiente con la misma sangría. */
function jobBlock(text, id) {
  const match = text.match(new RegExp(`^ {2}${id}:\\s*\\n((?: {3,}.*\\n?|\\s*\\n)+)`, 'm'));
  assert.ok(match, `no job \`${id}\``);
  return match[1];
}

test('every action is pinned by a full commit SHA, with its version beside it', async () => {
  for (const name of WORKFLOWS) {
    const raw = await readFile(path.join(ROOT, '.github', 'workflows', name), 'utf8');
    const uses = [...raw.matchAll(/uses:\s*(\S+)(.*)$/gm)];
    assert.notEqual(uses.length, 0, `${name} uses no action`);
    for (const [, action, rest] of uses) {
      assert.match(action, /@[0-9a-f]{40}$/, `${name}: ${action} is not pinned by SHA`);
      assert.match(rest, /#\s*v\d+\.\d+\.\d+/, `${name}: ${action} does not say its version`);
    }
  }
});

test('every job has a time limit', async () => {
  for (const name of WORKFLOWS) {
    const text = await workflow(name);
    const ids = jobIds(text);
    assert.notEqual(ids.length, 0, `${name} declares no job`);
    for (const id of ids) {
      assert.match(jobBlock(text, id), /^ {4}timeout-minutes: \d+\s*$/m, `${name}: ${id} has no limit`);
    }
  }
});

test('gitleaks is checked against its pinned and its official sha256 before it runs', async () => {
  const text = await workflow('ci.yml');
  assert.match(text, /GITLEAKS_SHA256: '[0-9a-f]{64}'/, 'no pinned sha256 for gitleaks');
  const install = text.slice(text.indexOf('name: Install gitleaks'));
  const checks = [...install.matchAll(/sha256sum --check/g)].map((m) => m.index);
  const extract = install.indexOf('tar -x');
  assert.equal(checks.length, 2, 'the pinned sum and the official checksums file, both');
  assert.ok(checks.every((at) => at < extract), 'the tarball is opened before it is verified');
  assert.match(install, /gitleaks_\$\{GITLEAKS_VERSION\}_checksums\.txt/);
});

test('Node is exact in .node-version, and CI reads it from there', async () => {
  const version = (await readFile(path.join(ROOT, '.node-version'), 'utf8')).trim();
  assert.match(version, /^\d+\.\d+\.\d+$/, '.node-version must be an exact x.y.z');

  const { engines } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const [, low, high] = engines.node.match(/^>=(\d+\.\d+\.\d+) <(\d+)$/) ?? [];
  const numbers = (text) => text.split('.').map(Number);
  const [major, minor, patch] = numbers(version);
  const [lowMajor, lowMinor, lowPatch] = numbers(low);
  assert.ok(major < Number(high), `${version} is outside engines ${engines.node}`);
  assert.ok(
    major > lowMajor ||
      (major === lowMajor && (minor > lowMinor || (minor === lowMinor && patch >= lowPatch))),
    `${version} is below engines ${engines.node}`,
  );

  const text = await workflow('ci.yml');
  assert.doesNotMatch(text, /node-version:\s/, 'CI must not name a Node version of its own');
  assert.match(text, /node-version-file: \.node-version/);
});
