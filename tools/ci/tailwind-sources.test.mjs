// Tailwind lee solo el código de UI (decisión del usuario, 2026-09-26): las palabras de specs,
// diccionarios, tools, e2e y docs emitían CSS muerto en la hoja inicial. Ver vault:
// 02-Arquitectura/Integracion Continua.md §4, regla 10.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Scanner } from '@tailwindcss/oxide';
import { compile } from 'tailwindcss';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENTRY = path.join(ROOT, 'projects/shell/src/styles.css');
const UI_SOURCES = /^projects\/(?:design-system\/src\/lib|showroom\/src|shell\/src)\//;

async function loadStylesheet(id, base) {
  const file =
    id.startsWith('.') || path.isAbsolute(id)
      ? path.resolve(base, id)
      : path.join(ROOT, 'node_modules', id === 'tailwindcss' ? 'tailwindcss/index.css' : id);
  return { path: file, base: path.dirname(file), content: await readFile(file, 'utf8') };
}

/** Los archivos que escanea @tailwindcss/postcss con styles.css, armados como lo arma él. */
async function scannedFiles() {
  const compiler = await compile(await readFile(ENTRY, 'utf8'), {
    base: path.dirname(ENTRY),
    loadStylesheet,
  });
  const root =
    compiler.root === 'none'
      ? []
      : compiler.root === null
        ? [{ base: ROOT, pattern: '**/*', negated: false }]
        : [{ ...compiler.root, negated: false }];
  const scanner = new Scanner({ sources: [...root, ...compiler.sources] });
  scanner.scan();
  return scanner.files.map((file) => path.relative(ROOT, file).replaceAll('\\', '/'));
}

describe('Tailwind sources', () => {
  it('scans the UI code of the three libraries that draw, and nothing else', async () => {
    const files = await scannedFiles();

    const outside = files.filter((file) => !UI_SOURCES.test(file) || file.endsWith('.spec.ts'));
    assert.deepEqual(outside, [], 'Tailwind escanea archivos que no son código de UI');
    for (const expected of [
      'projects/shell/src/app/layout/main-layout.html',
      'projects/design-system/src/lib/navigation/nav-rail.ts',
      'projects/showroom/src/lib/ui/prose.ts',
    ]) {
      assert.ok(files.includes(expected), `${expected} no se escanea`);
    }
  });
});
