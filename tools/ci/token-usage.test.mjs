/**
 * Tokens sin huecos (B14, hallazgos D6 y D7): todo token de tokens.css se usa en algún lado o su
 * excepción dice por qué, y el color que nav-routes.svg escribe literal es el de su token.
 * Ver vault: Nomenclatura de Componentes y Tokens.
 */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKENS_FILE = 'projects/design-system/src/styles/tokens.css';
const NAV_ROUTES = 'projects/shell/public/brand/nav-routes.svg';
const read = (file) => readFile(path.join(ROOT, file), 'utf8');

/** Token → por qué no aparece en ningún otro lado. Agregar uno es una decisión escrita. */
const UNUSED_ON_PURPOSE = {
  '--blue-63':
    'nav-routes.svg lo escribe literal: servido como imagen, un SVG no lee variables. Lo ata al token la prueba del color, abajo.',
};

async function listFiles(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(relative)));
    } else if (/\.(ts|html|css|svg)$/.test(entry.name) && relative !== TOKENS_FILE) {
      files.push(relative);
    }
  }
  return files;
}

/** Los colores hex del SVG que no son el valor del token. */
export function strayColors(svg, tokens, token) {
  const value = new RegExp(`^\\s*${token}:\\s*(#[0-9a-f]{6});`, 'im').exec(tokens)?.[1];
  assert.ok(value, `${token} is not a hex colour in tokens.css`);
  const colours = [...svg.matchAll(/#[0-9a-f]{6}\b/gi)].map(([colour]) => colour.toLowerCase());
  assert.ok(colours.length > 0, 'the SVG has no hex colour: the check would pass on nothing');
  return colours.filter((colour) => colour !== value.toLowerCase());
}

test('every token in tokens.css is used somewhere, or its exception says why', async () => {
  const tokens = await read(TOKENS_FILE);
  const names = [...tokens.matchAll(/^\s*(--[\w-]+):/gm)].map(([, name]) => name);
  // Lo que un token lee de otro cuenta como uso; su propia declaración, no.
  const references = tokens.replace(/^\s*--[\w-]+:/gm, '');
  const corpus = [references, ...(await Promise.all((await listFiles('projects')).map(read)))];
  const unused = names.filter((name) => {
    const mention = new RegExp(`${name}(?![\\w-])`);
    return !corpus.some((text) => mention.test(text)) && !(name in UNUSED_ON_PURPOSE);
  });
  assert.deepEqual(unused, []);
});

test('the colour nav-routes.svg writes by hand is the value of --blue-63', async () => {
  assert.deepEqual(strayColors(await read(NAV_ROUTES), await read(TOKENS_FILE), '--blue-63'), []);
});

test('the colour check catches a hand-written colour that drifted from its token', () => {
  const tokens = '  --blue-63: #7c93f2;\n';
  assert.deepEqual(strayColors('<path stroke="#7c93f3"/>', tokens, '--blue-63'), ['#7c93f3']);
});
