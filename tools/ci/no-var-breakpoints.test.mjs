/**
 * Un breakpoint mapeado con `var()` compila y nunca se cumple: Tailwind lo vuelve
 * `@media (width >= var(...))`, y una propiedad personalizada no se sustituye dentro de
 * una media query. Nada falla y el layout nunca cambia. DS-5 cayó en eso (ver
 * styles.css); `--breakpoint-nav-bottom` se lee desde TypeScript con `readPixels` y se
 * aplica con `matchMedia`. La regla 10 no lo ve: la forma rota no lleva px crudo.
 * Ver vault: 08-Sistema-de-Diseno/Componentes/Navegacion.md. `npm run test:tools`.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STYLES = path.join(ROOT, 'projects', 'shell', 'src', 'styles.css');

/** El cuerpo del bloque `@theme ... { ... }`, sin comentarios. */
async function themeBlock() {
  const css = await readFile(STYLES, 'utf8');
  const start = css.indexOf('@theme');
  assert.ok(start >= 0, 'styles.css no declara un bloque @theme');
  const open = css.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return css.slice(open + 1, end).replace(/\/\*[\s\S]*?\*\//g, '');
}

test('the Tailwind theme declares no breakpoint at all', async () => {
  const body = await themeBlock();
  const declared = [...body.matchAll(/^\s*(--breakpoint-[\w-]*)\s*:/gm)].map((m) => m[1]);

  assert.deepEqual(
    declared,
    [],
    'Un --breakpoint-* mapeado a var() produce una media query que nunca se cumple, ' +
      'y uno mapeado a un literal mete un px crudo en styles.css. El punto de corte ' +
      'se lee del token desde TypeScript: ver lib/navigation/viewport.ts.',
  );
});

test('the breakpoint token itself still exists, in tokens.css', async () => {
  const tokens = await readFile(
    path.join(ROOT, 'projects', 'design-system', 'src', 'styles', 'tokens.css'),
    'utf8',
  );

  assert.match(
    tokens,
    /--breakpoint-nav-bottom:\s*var\(--size-\d+\);/,
    'El punto de corte sigue siendo una decision de diseno y vive en tokens.css',
  );
});
