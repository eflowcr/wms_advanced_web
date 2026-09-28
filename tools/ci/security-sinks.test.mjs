// Cada sumidero de código y de almacenamiento, probado con ESLint sobre una ruta virtual: la regla
// 9 lo rechaza, y lo inocente de al lado pasa. Ver vault: 02-Arquitectura/Integracion Continua.md.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const eslint = new ESLint({ cwd: ROOT });
const SECURITY = /^(no-eval|no-new-func|no-implied-eval|no-restricted-globals|no-restricted-syntax)$/;

/** Los errores de seguridad que da ESLint a un fragmento dentro de una biblioteca. */
async function securityErrors(code, file = 'projects/core/src/lib/probe.ts') {
  const [result] = await eslint.lintText(`${code}\n`, { filePath: path.join(ROOT, file) });
  return result.messages.filter((m) => m.severity === 2 && SECURITY.test(m.ruleId ?? ''));
}

const forbids = (code) =>
  it(`rejects ${code}`, async () => {
    assert.notEqual((await securityErrors(code)).length, 0);
  });

const allows = (code) =>
  it(`lets ${code} through`, async () => {
    assert.deepEqual(await securityErrors(code), []);
  });

describe('code sinks', () => {
  forbids(`eval('1 + 1');`);
  forbids(`new Function('return 1');`);
  forbids(`setTimeout('run()', 10);`);
  forbids(`setInterval('run()', 10);`);
  forbids(`document.body.outerHTML = '<p></p>';`);
  forbids(`document.body.insertAdjacentHTML('beforeend', '<p></p>');`);
  forbids(`document.write('<p></p>');`);
  forbids(`document.writeln('<p></p>');`);
  allows(`setTimeout(() => undefined, 10);`);
  allows(`const shape = document.body.outerHTML;`);
  allows(`document.body.insertAdjacentElement('beforeend', document.createElement('p'));`);
  allows(`document.title = 'eWMS';`);
});

describe('storage sinks', () => {
  forbids(`localStorage.setItem('k', 'v');`);
  forbids(`window.sessionStorage.clear();`);
  forbids(`window['localStorage'].getItem('k');`);
  forbids(`globalThis['sessionStorage'].clear();`);
  forbids(`indexedDB.open('ewms');`);
  forbids(`window.indexedDB.open('ewms');`);
  forbids(`document.cookie = 'k=v';`);
  forbids(`const all = document.cookie;`);
  allows(`const storage = new Map<string, string>();`);
});

describe('the storage message', () => {
  it('names nothing that does not exist, and asks for no line exception', async () => {
    const messages = (await securityErrors(`localStorage.getItem('k');`)).map((m) => m.message);
    assert.notEqual(messages.length, 0);
    for (const message of messages) {
      assert.doesNotMatch(message, /token store/i);
      assert.doesNotMatch(message, /disable this rule/i);
    }
  });
});

// REQ-FE-DS4-002 PACQ-01.4: los favoritos no guardan nada en el navegador, y nada lo esconde.
describe('favorites keep nothing in the browser', () => {
  const STORAGE_RULES = new Set(['no-restricted-globals', 'no-restricted-syntax']);

  it('the storage rules reach the favorites code and the shell that provides it', async () => {
    for (const file of [
      'projects/design-system/src/lib/favorites/probe.ts',
      'projects/shell/src/app/probe.ts',
    ]) {
      const errors = await securityErrors(`localStorage.setItem('k', 'v');`, file);
      assert.notEqual(errors.length, 0, file);
    }
  });

  it('no line silences them, except the language preference (ADR 0008)', () => {
    const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter((file) => /\.(ts|mts|cts|js|mjs|cjs|html)$/.test(file));
    const silencing = [];
    for (const file of files) {
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      const directives = /(?:\/\/|\/\*|<!--)\s*eslint-disable(?:-next-line|-line)?(?![\w-])(.*)/g;
      for (const [, rest] of source.matchAll(directives)) {
        const [named] = rest.split(/\s--\s|\*\/|-->/);
        const rules = named.split(',').map((rule) => rule.trim());
        // Sin reglas nombradas, el directivo apaga todas: también las de almacenamiento.
        if (rules.every((rule) => rule === '') || rules.some((rule) => STORAGE_RULES.has(rule))) {
          silencing.push(file);
        }
      }
    }
    assert.deepEqual(silencing, ['projects/core/src/lib/i18n/language.service.ts']);
  });
});
