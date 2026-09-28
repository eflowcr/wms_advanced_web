import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { resolveFile } from './serve.mjs';

describe('resolveFile', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'serve-'));
  mkdirSync(path.join(root, 'i18n'));
  writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  writeFileSync(path.join(root, 'main-ABC.js'), '');
  writeFileSync(path.join(root, 'i18n', 'es.json'), '{}');
  after(() => rmSync(root, { recursive: true, force: true }));

  it('serves a file that exists, query string and all', async () => {
    assert.deepEqual(await resolveFile('/main-ABC.js?v=1', root), {
      status: 200,
      file: path.join(root, 'main-ABC.js'),
    });
    assert.equal((await resolveFile('/i18n/es.json', root)).file, path.join(root, 'i18n', 'es.json'));
  });

  it('answers a route of the app with index.html, as a deployment does', async () => {
    const index = path.join(root, 'index.html');
    assert.deepEqual(await resolveFile('/', root), { status: 200, file: index });
    assert.deepEqual(await resolveFile('/catalogos/articulos', root), { status: 200, file: index });
  });

  it('answers a missing chunk with 404, never with the page', async () => {
    assert.deepEqual(await resolveFile('/chunk-GONE.js', root), { status: 404 });
  });

  it('never leaves its folder', async () => {
    assert.deepEqual(await resolveFile('/../package.json', root), { status: 403 });
    assert.deepEqual(await resolveFile('/%2e%2e/package.json', root), { status: 403 });
  });
});
