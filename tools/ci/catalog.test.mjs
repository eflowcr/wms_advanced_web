/**
 * El catálogo sin huecos (B14, hallazgos D4 y D9): todo componente o directiva que exporta
 * public-api.ts tiene una entrada que lo nombra, y toda anatomía nombra un token que existe.
 * Ver vault: Showroom - Especificacion §6.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DS_SRC = 'projects/design-system/src';
const CATALOG = 'projects/showroom/src/lib/catalog.ts';
const PAGES = 'projects/showroom/src/lib/pages';
const read = (file) => readFile(path.join(ROOT, file), 'utf8');

/** `[ewmsTooltip]` y `form[ewmsForm]` se buscan como se escriben en una plantilla: `ewmsTooltip`. */
function normalized(selector) {
  return selector.replace(/^[a-z-]*\[/, '').replace(/\]$/, '');
}

/** Selectores de lo que exporta un módulo, siguiendo sus `export … from`. */
async function exportedSelectors(file, only = null) {
  const code = await read(file);
  const selectors = [];
  // Cada decorador con su propia clase: una interna sin `export` (FormErrors) no cuenta.
  for (const decorator of code.matchAll(/@(?:Component|Directive)\(\{/g)) {
    const rest = code.slice(decorator.index);
    const declaration = /\n(export )?class (\w+)/.exec(rest);
    const selector = /selector:\s*'([^']+)'/.exec(rest.slice(0, declaration?.index))?.[1];
    if (declaration?.[1] && selector && (only === null || only.includes(declaration[2]))) {
      selectors.push(selector);
    }
  }
  for (const match of code.matchAll(/export (\*|\{[^}]*\}) from '(\.[^']+)'/g)) {
    const target = path.posix.join(path.posix.dirname(file), `${match[2]}.ts`);
    const names =
      match[1] === '*'
        ? only
        : [...match[1].matchAll(/(?:type\s+)?(\w+)(?:\s+as\s+(\w+))?/g)].map((m) => m[1]);
    if (existsSync(path.join(ROOT, target))) {
      selectors.push(...(await exportedSelectors(target, names)));
    }
  }
  return selectors;
}

/** Todo lo que el catálogo dice que una página cubre: las listas `selectors: [...]`. */
function catalogSelectors(code) {
  return [...code.matchAll(/selectors:\s*\[([^\]]*)\]/g)].flatMap(([, list]) =>
    [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]),
  );
}

async function listFiles(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(relative)));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(relative);
    }
  }
  return files;
}

test('every component and directive of public-api.ts has a catalogue entry that names it', async () => {
  const exported = await exportedSelectors(`${DS_SRC}/public-api.ts`);
  assert.ok(exported.length > 20, `only ${exported.length} selectors found: the parser broke`);
  const covered = new Set(catalogSelectors(await read(CATALOG)).map(normalized));
  const missing = [...new Set(exported.map(normalized))].filter((name) => !covered.has(name));
  assert.deepEqual(missing.sort(), []);
});

test('every anatomy names a token that exists in tokens.css', async () => {
  const tokens = await read(`${DS_SRC}/styles/tokens.css`);
  const declared = new Set([...tokens.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
  const missing = [];
  for (const file of await listFiles(PAGES)) {
    for (const [, token] of (await read(file)).matchAll(/\btoken: '(--[\w-]+)'/g)) {
      if (!declared.has(token)) {
        missing.push(`${file}: ${token}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
