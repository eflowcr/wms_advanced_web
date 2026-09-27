/**
 * Fija qué hacen los patrones del escaneo de atajos (una regex que deja de coincidir pasa en
 * vacío) y corre el escaneo real en `npm test`. node:test sin Angular: `npm run test:tools`.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ts from 'typescript';
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
    // El falso positivo que acotó la regla: read-token.ts compara una unidad CSS con
    // 's' (segundos). Una compuerta que se quejara de eso se apagaría en una semana.
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
    // Un campo que mide lo que se tipea en él no es un listener global.
    assert.deepEqual(globalListeners("<input (keydown)=\"onKeydown($event)\" />"), []);
    assert.deepEqual(globalListeners("this.field().nativeElement.addEventListener('keydown', f);"), []);
  });
});

describe('the repository itself', () => {
  it('names every shortcut key only in the map files, and mounts one listener', async () => {
    // La compuerta de verdad, como proceso hijo: un fallo trae la misma salida que ve
    // quien corre `npm run lint:shortcuts`. Lo de arriba prueba los patrones; esto, la fuente.
    const { stdout } = await run(process.execPath, [path.join(HERE, 'check-shortcuts.mjs')], {
      cwd: ROOT,
    });

    assert.match(stdout, /named only in \d+ map file/);
    assert.match(stdout, /one global listener/);
  });

  it('the map files it trusts actually exist and carry bindings', async () => {
    // Si no, el escaneo pasa porque no encontró nada que buscar.
    for (const mapFile of MAP_FILES) {
      const source = await readFile(path.join(ROOT, mapFile), 'utf8');
      assert.ok(bindingKeys(source).length >= 4, `${mapFile} declares fewer than four bindings`);
    }
  });

  // REQ-FE-DS4-001 PACQ-03.5 (HG-03): el umbral vive en tokens.css y el motor solo lo lee.
  it('the scan threshold lives in tokens.css, and no engine file writes its value', async () => {
    const tokens = await readFile(
      path.join(ROOT, 'projects/design-system/src/styles/tokens.css'),
      'utf8',
    );
    const declared = (name) =>
      tokens
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith(`${name}:`))
        ?.slice(name.length + 1, -1)
        .trim() ?? '';
    const reference = /^var\((--[\w-]+)\)$/;
    let value = declared('--threshold-scan-keystroke');
    for (let ref = reference.exec(value); ref; ref = reference.exec(value)) {
      value = declared(ref[1]);
    }
    const ms = Number(/^(\d+)ms$/.exec(value)?.[1]);
    assert.ok(ms > 0, `--threshold-scan-keystroke does not resolve to milliseconds: «${value}»`);

    const lib = path.join(ROOT, 'projects/design-system/src/lib');
    const engine = [];
    for (const file of await readdir(lib, { recursive: true })) {
      if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;
      const source = await readFile(path.join(lib, file), 'utf8');
      const inKeyboard = file.split(path.sep)[0] === 'keyboard';
      if (inKeyboard || source.includes('SCAN_THRESHOLD_TOKEN')) {
        engine.push([file.split(path.sep).join('/'), source]);
      }
    }
    assert.ok(engine.length > 1, 'found no file of the keyboard engine');

    // Literales y no texto: «50 ms» en un comentario explica, no decide.
    const withUnit = new RegExp(`(^|[^0-9])${ms} *ms([^a-z]|$)`);
    const written = [];
    for (const [file, source] of engine) {
      const visit = (node) => {
        const number = ts.isNumericLiteral(node) && Number(node.text) === ms;
        const text = ts.isStringLiteralLike(node) && withUnit.test(node.text);
        if (number || text) written.push(`${file}: ${node.getText()}`);
        ts.forEachChild(node, visit);
      };
      visit(ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true));
    }
    assert.deepEqual(written, []);
  });
});
