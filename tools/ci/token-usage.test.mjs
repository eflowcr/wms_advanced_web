/**
 * Tokens sin huecos: todo token de tokens.css lo consume código de producción, o su excepción dice
 * por qué; y el color que nav-routes.svg escribe literal es el de su token. Ver vault: Nomenclatura
 * de Componentes y Tokens.
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

/**
 * Lo que no es consumo: las pruebas, el soporte de pruebas y las páginas del catálogo, que muestran
 * un token para documentarlo. Contaban como uso y dejaban pasar un token que nadie pinta.
 */
const NOT_PRODUCTION = /\.spec\.ts$|\.testing\.ts$|^projects\/testing\/|^projects\/showroom\/src\/lib\/pages\//;

/** Token → por qué ningún código de producción lo consume. Agregar uno es una decisión escrita. */
const UNUSED_ON_PURPOSE = {
  '--blue-63':
    'nav-routes.svg lo escribe literal: servido como imagen, un SVG no lee variables. Lo ata al token la prueba del color, abajo.',
  '--color-brand-blue':
    'El azul de marca, sin utilidad en el tema a propósito: el azul es solo acción. Lo muestran las páginas Marca y Color del catálogo.',
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

/** Los tokens que ningún texto del corpus consume; lo que un token lee de otro cuenta como uso. */
export function unusedTokens(tokens, corpus) {
  const names = [...tokens.matchAll(/^\s*(--[\w-]+):/gm)].map(([, name]) => name);
  const references = tokens.replace(/^\s*--[\w-]+:/gm, '');
  return names.filter((name) => {
    const mention = new RegExp(`${name}(?![\\w-])`);
    return ![references, ...corpus].some((text) => mention.test(text));
  });
}

async function productionCorpus() {
  const files = (await listFiles('projects')).filter((file) => !NOT_PRODUCTION.test(file));
  return Promise.all(files.map(read));
}

/** Los colores hex del SVG que no son el valor del token. */
export function strayColors(svg, tokens, token) {
  const value = new RegExp(`^\\s*${token}:\\s*(#[0-9a-f]{6});`, 'im').exec(tokens)?.[1];
  assert.ok(value, `${token} is not a hex colour in tokens.css`);
  const colours = [...svg.matchAll(/#[0-9a-f]{6}\b/gi)].map(([colour]) => colour.toLowerCase());
  assert.ok(colours.length > 0, 'the SVG has no hex colour: the check would pass on nothing');
  return colours.filter((colour) => colour !== value.toLowerCase());
}

test('every token in tokens.css is consumed by production code, or its exception says why', async () => {
  const unused = unusedTokens(await read(TOKENS_FILE), await productionCorpus());
  assert.deepEqual(unused.filter((name) => !(name in UNUSED_ON_PURPOSE)), []);
});

test('and every exception is still one: a token that production consumes leaves the list', async () => {
  const unused = unusedTokens(await read(TOKENS_FILE), await productionCorpus());
  assert.deepEqual(Object.keys(UNUSED_ON_PURPOSE).filter((name) => !unused.includes(name)), []);
});

test('a spec or a catalogue page naming a token is not a use of it', () => {
  const tokens = '  --color-lonely: #123456;\n';
  assert.deepEqual(unusedTokens(tokens, ['<div class="bg-primary"></div>']), ['--color-lonely']);
  assert.ok(NOT_PRODUCTION.test('projects/design-system/src/lib/button/button.spec.ts'));
  assert.ok(NOT_PRODUCTION.test('projects/showroom/src/lib/pages/foundations/colors.ts'));
  assert.ok(!NOT_PRODUCTION.test('projects/showroom/src/lib/layout/showroom-layout.html'));
});

test('the colour nav-routes.svg writes by hand is the value of --blue-63', async () => {
  assert.deepEqual(strayColors(await read(NAV_ROUTES), await read(TOKENS_FILE), '--blue-63'), []);
});

test('the colour check catches a hand-written colour that drifted from its token', () => {
  const tokens = '  --blue-63: #7c93f2;\n';
  assert.deepEqual(strayColors('<path stroke="#7c93f3"/>', tokens, '--blue-63'), ['#7c93f3']);
});
