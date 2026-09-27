/**
 * Tipografía cerrada (B12): cada @font-face apunta a un archivo que existe, con swap y su rango;
 * la mono es JetBrains Mono sobre la pila del sistema, sin precarga y con su licencia; y cada
 * variante de texto declara tamaño, peso e interlineado. Ver vault: Tipografia.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBLIC_DIR = 'projects/shell/public';
const read = (file) => readFile(path.join(ROOT, file), 'utf8');

const styles = await read('projects/shell/src/styles.css');
const tokens = await read('projects/design-system/src/styles/tokens.css');
const host = await read('projects/shell/src/index.html');
const notices = await read('THIRD-PARTY-NOTICES.md');

const VARIANTS = ['h1', 'h2', 'h3', 'h4', 'p', 'caption', 'mono'];

const faces = [...styles.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => ({
  family: /font-family:\s*'([^']+)'/.exec(body)?.[1],
  weight: /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim(),
  display: /font-display:\s*([^;]+);/.exec(body)?.[1]?.trim(),
  src: /url\('\/([^']+)'\)/.exec(body)?.[1],
  ranged: /unicode-range:/.test(body),
}));

function declared(name, sheet = tokens) {
  return new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(sheet)?.[1]?.trim();
}

/** Sigue las `var(--x)` de tokens.css hasta el valor escrito. */
function resolve(value) {
  return value?.replace(/var\((--[\w-]+)\)/g, (_, name) => resolve(declared(name)) ?? '');
}

test('every @font-face points to a file in public/, swaps and declares its range', () => {
  assert.ok(faces.length > 0, 'styles.css declares no @font-face');
  for (const face of faces) {
    assert.ok(
      face.src && existsSync(path.join(ROOT, PUBLIC_DIR, face.src)),
      `${face.src} is missing`,
    );
    assert.equal(face.display, 'swap', `${face.src} does not swap`);
    assert.ok(face.ranged, `${face.src} has no unicode-range`);
  }
});

test('the mono family is JetBrains Mono, with the system stack behind it', () => {
  assert.match(resolve(declared('--font-family-mono')) ?? '', /^'JetBrains Mono', ui-monospace/);
});

test('JetBrains Mono comes in its two static faces, Regular 400 and Bold 700', () => {
  const weights = faces.filter((face) => face.family === 'JetBrains Mono').map((f) => f.weight);
  assert.deepEqual(weights.sort(), ['400', '700']);
});

test('JetBrains Mono is not preloaded: no page needs it before the first paint', () => {
  assert.doesNotMatch(host, /<link[^>]*rel="preload"[^>]*jetbrains/is);
});

test('THIRD-PARTY-NOTICES.md carries the OFL of JetBrains Mono', () => {
  assert.match(notices, /## JetBrains Mono[\s\S]*SIL OPEN FONT LICENSE Version 1\.1/);
});

/** La clave del @theme de Tailwind que lee cada parte (el tamaño es la propia `--text-<v>`). */
const THEME_KEYS = { size: '', weight: '--font-weight', 'line-height': '--line-height' };

test('every text variant declares its size, weight and line height, and the theme reads them', () => {
  const missing = VARIANTS.flatMap((variant) =>
    Object.entries(THEME_KEYS).flatMap(([part, key]) =>
      [
        [tokens, `--text-${variant}-${part}`],
        [styles, `--text-${variant}${key}`],
      ]
        .filter(([sheet, name]) => declared(name, sheet) === undefined)
        .map(([, name]) => name),
    ),
  );
  assert.deepEqual(missing, []);
});
