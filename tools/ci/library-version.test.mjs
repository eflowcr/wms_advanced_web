/**
 * La versión del design-system está escrita dos veces: en su package.json y como literal en
 * version.ts, porque ng-packagr no resuelve un import que sale de src/. Esto las mantiene iguales,
 * y lo mismo con la de la aplicación, que muestra la marca de agua. `npm run test:tools`.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIBRARY = path.join(ROOT, 'projects/design-system');

test('version.ts says the same version as the package.json of the library', async () => {
  const manifest = JSON.parse(await readFile(path.join(LIBRARY, 'package.json'), 'utf8'));
  const source = await readFile(path.join(LIBRARY, 'src/lib/version.ts'), 'utf8');
  const literal = source.match(/DESIGN_SYSTEM_VERSION = '([^']+)'/)?.[1];

  assert.equal(literal, manifest.version);
});

test('the app has a SemVer version with its own CHANGELOG entry (DEV-007, ADR 0018)', async () => {
  const { version } = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const changelog = await readFile(path.join(ROOT, 'CHANGELOG.md'), 'utf8').catch(() => '');

  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.notEqual(version, '0.0.0', 'the app starts numbered at 0.1.0');
  assert.match(changelog, new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm'));
});

test('the shell version.ts says the same version as the root package.json', async () => {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const source = await readFile(path.join(ROOT, 'projects/shell/src/app/version.ts'), 'utf8');
  const literal = source.match(/APP_VERSION = '([^']+)'/)?.[1];

  assert.equal(literal, manifest.version);
});
