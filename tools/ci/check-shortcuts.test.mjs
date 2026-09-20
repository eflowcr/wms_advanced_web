/**
 * Tests for the shortcut source scan, AND the scan itself over this repository.
 *
 * Both halves matter. The unit cases pin down what the patterns do -- a gate
 * whose regular expression quietly stops matching is a gate that passes
 * vacuously for a year. Running the real scan here rather than as a ninth CI
 * step keeps it inside `npm test`, which is already blocking, and keeps the
 * eight gates eight.
 *
 * Plain node:test, no Angular. Run with `npm run test:tools` (part of `npm test`).
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { bindingKeys, globalListeners, keyMentions, lineOf, MAP_FILES } from './check-shortcuts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const run = promisify(execFile);

describe('bindingKeys', () => {
  it('reads every key out of a map', () => {
    const source = `export const MAP = {
      search: { key: '/', chord: ['/'] },
      create: { key: 'n', alt: true, chord: ['Alt', 'N'] },
      cancel: { key: 'Escape', insideTextFields: true, chord: ['Esc'] },
    };`;

    assert.deepEqual(bindingKeys(source), ['/', 'n', 'Escape']);
  });

  it('finds nothing in a file that declares no binding', () => {
    assert.deepEqual(bindingKeys("const label = 'key: Escape';"), []);
  });
});

describe('keyMentions', () => {
  it('flags a screen comparing event.key against a single character', () => {
    const found = keyMentions("if (event.key === 'n' && event.altKey) { this.create(); }", 'n');
    assert.equal(found.length, 1);
  });

  it('flags a case label, which is the other way a screen answers a key', () => {
    assert.equal(keyMentions("switch (event.key) { case '/': return; }", '/').length, 1);
  });

  it('does NOT flag a single character used as anything but a key', () => {
    /*
     * The false positive that narrowed this rule: read-token.ts compares a CSS
     * unit against 's' to mean SECONDS. A gate that cried about that would be
     * turned off within a week, which is worse than not having it.
     */
    assert.deepEqual(keyMentions("return match[2] === 's' ? value * 1000 : value;", 's'), []);
    assert.deepEqual(keyMentions("const sep = '/';\nreturn parts.join('/');", '/'), []);
  });

  it('flags a named key spelled anywhere, because `Escape` means only one thing', () => {
    assert.equal(keyMentions("this.onEscape('Escape');", 'Escape').length, 1);
  });

  it('reports the line, so the error points somewhere', () => {
    const source = "const a = 1;\n\nif (event.key === '/') {\n}";
    const [found] = keyMentions(source, '/');
    assert.equal(lineOf(source, found.index), 3);
  });
});

describe('globalListeners', () => {
  it('flags a second engine, however it is spelled', () => {
    for (const source of [
      "document.addEventListener('keydown', onKey);",
      'window.addEventListener("keyup", onKey);',
      "@HostListener('document:keydown', ['$event'])",
      "host: { '(document:keydown)': 'onKey($event)' }",
    ]) {
      assert.equal(globalListeners(source).length, 1, source);
    }
  });

  it('leaves a listener on the component`s own element alone', () => {
    // A field measuring what is typed INTO IT is not a global listener.
    assert.deepEqual(globalListeners("<input (keydown)=\"onKeydown($event)\" />"), []);
    assert.deepEqual(globalListeners("this.field().nativeElement.addEventListener('keydown', f);"), []);
  });
});

describe('the repository itself', () => {
  it('names every shortcut key only in the map files, and mounts one listener', async () => {
    /*
     * THE GATE, RUN FOR REAL. Everything above proves the patterns work; this
     * proves they were pointed at the source. It runs the script as a child
     * process so a failure carries the same output a developer sees from
     * `npm run lint:shortcuts`.
     */
    const { stdout } = await run(process.execPath, [path.join(HERE, 'check-shortcuts.mjs')], {
      cwd: ROOT,
    });

    assert.match(stdout, /named only in \d+ map file/);
    assert.match(stdout, /one global listener/);
  });

  it('the map files it trusts actually exist and carry bindings', async () => {
    // Otherwise the scan passes because it found nothing to look for.
    const { readFile } = await import('node:fs/promises');
    for (const mapFile of MAP_FILES) {
      const source = await readFile(path.join(ROOT, mapFile), 'utf8');
      assert.ok(bindingKeys(source).length >= 4, `${mapFile} declares fewer than four bindings`);
    }
  });
});
