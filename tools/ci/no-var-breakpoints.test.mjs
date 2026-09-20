/**
 * A BREAKPOINT MAPPED THROUGH `var()` COMPILES AND NEVER MATCHES.
 *
 * Tailwind turns `--breakpoint-x` into `@media (width >= <value>)`. When the
 * value is `var(--something)` the media query is invalid: a custom property is
 * not substituted inside a media feature, so the condition is false at every
 * width. Nothing fails at build time, no gate objects, and the layout simply
 * never changes -- which is the worst shape a defect can take.
 *
 * DS-5 walked into it and backed out (see the comment in styles.css). The
 * system's one point of change, `--breakpoint-nav-bottom`, is read from
 * TypeScript with `readPixels` and applied through `matchMedia` instead.
 *
 * This test stops the mapping from being added back. It is not gate 10's job:
 * gate 10 objects to a raw pixel value, and the broken form has none.
 *
 * Run with `npm run test:tools`.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const STYLES = path.join(ROOT, 'projects', 'shell', 'src', 'styles.css');

/** The body of the `@theme ... { ... }` block, comments stripped. */
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
