import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import {
  checkDictionaryVersions,
  DICTIONARIES,
  dictionaryVersions,
  fingerprint,
  OUTPUT,
  renderVersions,
} from './dictionary-versions.mjs';

/** Un proyecto de juguete: los diccionarios y, si se da, la tabla generada. */
function write(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'dict-'));
  for (const [file, content] of Object.entries(files)) {
    write(root, file, content);
  }
  return root;
}

describe('dictionary versions', () => {
  const roots = [];
  after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

  it('changing a dictionary changes its URL, and only its own', async () => {
    const root = fixture({
      [`${DICTIONARIES}/es.json`]: '{"a":"uno"}\n',
      [`${DICTIONARIES}/showroom/es.json`]: '{"b":"dos"}\n',
    });
    roots.push(root);
    const before = await dictionaryVersions(root);

    writeFileSync(path.join(root, DICTIONARIES, 'es.json'), '{"a":"uno, corregido"}\n');
    const after = await dictionaryVersions(root);

    assert.deepEqual(Object.keys(before), ['es', 'showroom/es']);
    assert.notEqual(after['es'], before['es']);
    assert.equal(after['showroom/es'], before['showroom/es']);
  });

  it('the same content gives the same fingerprint, with CRLF or LF', () => {
    assert.equal(fingerprint('{"a":1}\r\n'), fingerprint('{"a":1}\n'));
    assert.match(fingerprint('{}'), /^[0-9a-f]{10}$/);
  });

  it('the gate fails on a stale table, and passes once it is regenerated', async () => {
    const root = fixture({ [`${DICTIONARIES}/es.json`]: '{"a":"uno"}\n' });
    roots.push(root);
    write(root, OUTPUT, renderVersions({ es: '0000000000' }));

    assert.equal((await checkDictionaryVersions(root)).length, 1);
    assert.match((await checkDictionaryVersions(root))[0], /is stale/);

    write(root, OUTPUT, renderVersions(await dictionaryVersions(root)));
    assert.deepEqual(await checkDictionaryVersions(root), []);
  });

  it('a missing table is a failure too, not a pass', async () => {
    const root = fixture({ [`${DICTIONARIES}/es.json`]: '{}\n' });
    roots.push(root);

    assert.match((await checkDictionaryVersions(root))[0] ?? '', /is missing/);
  });

  it('the committed table is the one the dictionaries give', async () => {
    assert.deepEqual(await checkDictionaryVersions(), []);
  });
});
