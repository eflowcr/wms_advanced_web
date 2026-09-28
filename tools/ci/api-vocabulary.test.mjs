/**
 * Un solo vocabulario de API (B13, hallazgo D5): la misma idea se pide con el mismo nombre en
 * todo componente, y los nombres viejos no quedan en projects/. Ver vault: Nomenclatura.
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB = 'projects/design-system/src/lib';
const source = (file) => readFile(path.join(ROOT, LIB, file), 'utf8');

/** Nombre viejo → por qué no puede volver. */
const RETIRED = [
  [/\[state\]="/, 'the Input draws an error with [error], like Select and DatePicker'],
  [/DialogTone/, 'the Dialog paint is DialogVariant'],
  [/confirm\(\{[^}]*\btone:/s, 'DialogService.confirm takes variant, not tone'],
  [/size="(compact|page)"|'compact' \| 'page'/, "EmptyState sizes are 'sm' | 'lg'"],
  [/\btone: 'danger'|\.tone === 'danger'/, 'MenuItem paints with variant, not tone'],
];

async function listFiles(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(relative)));
    } else if (/\.(ts|html)$/.test(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

test('the three fields draw an error with the same input: error = input<boolean>', async () => {
  for (const file of ['input/input.ts', 'select/select.ts', 'date-picker/date-picker.ts']) {
    const code = await source(file);
    assert.match(code, /readonly error = input<boolean>\(false\);/, file);
    assert.doesNotMatch(code, /readonly state = input</, file);
  }
});

test('semantic paint is `variant` in Banner, Badge and Dialog', async () => {
  assert.match(await source('banner/banner.ts'), /readonly variant = input</);
  assert.match(await source('badge/badge.ts'), /readonly variant = input</);
  const dialog = await source('dialog/dialog.types.ts');
  assert.match(dialog, /readonly variant: DialogVariant;/);
  assert.doesNotMatch(dialog, /\btone\b/);
});

test('MenuItem paints with `variant` too, like Banner, Badge and Dialog', async () => {
  const menu = await source('menu/menu.types.ts');
  assert.match(menu, /readonly variant\?: 'danger';/);
  assert.doesNotMatch(menu, /\btone\b/);
});

test('FieldState stays inside the library: the public API does not export it and nobody outside names it', async () => {
  assert.doesNotMatch(
    await readFile(path.join(ROOT, 'projects/design-system/src/public-api.ts'), 'utf8'),
    /^export[^;]*\bFieldState\b/m,
  );
  const outside = [];
  for (const file of [...(await listFiles('projects')), ...(await listFiles('e2e'))]) {
    if (!file.startsWith('projects/design-system/') && /\bFieldState\b/.test(await readFile(path.join(ROOT, file), 'utf8'))) {
      outside.push(file);
    }
  }
  assert.deepEqual(outside, []);
});

test('EmptyState sizes come from the shared size vocabulary', async () => {
  assert.match(
    await source('empty-state/empty-state.ts'),
    /export type EmptyStateSize = 'sm' \| 'lg';/,
  );
});

test('FavoritesNav takes the ground type of the Button instead of redeclaring it', async () => {
  const code = await source('favorites/favorites-nav.ts');
  assert.match(code, /readonly ground = input<ButtonGround>/);
  assert.doesNotMatch(code, /input<'navy' \| 'surface'>/);
});

test('no retired name is left in projects/', async () => {
  const hits = [];
  for (const file of await listFiles('projects')) {
    const code = await readFile(path.join(ROOT, file), 'utf8');
    for (const [pattern, why] of RETIRED) {
      if (pattern.test(code)) {
        hits.push(`${file}: ${why}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
