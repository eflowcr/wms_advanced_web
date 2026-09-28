// Tailwind lee solo el código de UI (decisión del usuario, 2026-09-26): las palabras de specs,
// diccionarios, tools, e2e y docs emitían CSS muerto en la hoja inicial. Ver vault:
// 02-Arquitectura/Integracion Continua.md §4, regla 10.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
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

/** Las bibliotecas de projects/ que dibujan: una plantilla .html o un @Component fuera de las specs. */
async function drawingProjects() {
  const drawing = [];
  for (const project of await readdir(path.join(ROOT, 'projects'))) {
    const files = await readdir(path.join(ROOT, 'projects', project), { recursive: true });
    for (const file of files.filter((name) => /\.(html|ts)$/.test(name) && !name.endsWith('.spec.ts'))) {
      const full = path.join(ROOT, 'projects', project, file);
      if (file.endsWith('.html') || /@Component\(/.test(await readFile(full, 'utf8'))) {
        drawing.push(project);
        break;
      }
    }
  }
  return drawing;
}

/** Las que dibujan y de las que Tailwind no escanea ningún archivo. */
export function unscanned(scanned, drawing) {
  return drawing.filter((project) => !scanned.some((file) => file.startsWith(`projects/${project}/`)));
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

  it('every library with templates or components is in @source, or its classes would not exist', async () => {
    assert.deepEqual(unscanned(await scannedFiles(), await drawingProjects()), []);
  });

  it('a new library that draws and is not in @source is caught', () => {
    const scanned = ['projects/shell/src/app/app.html', 'projects/design-system/src/lib/x.ts'];
    assert.deepEqual(unscanned(scanned, ['shell', 'design-system', 'inventory']), ['inventory']);
  });

  it('the scanner it imports is a declared devDependency, at the version of the lock', async () => {
    const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
    const lock = JSON.parse(await readFile(path.join(ROOT, 'package-lock.json'), 'utf8'));
    const locked = lock.packages['node_modules/@tailwindcss/oxide']?.version;
    assert.ok(locked, '@tailwindcss/oxide is not in the lock');
    assert.equal(pkg.devDependencies['@tailwindcss/oxide'], locked);
  });
});
