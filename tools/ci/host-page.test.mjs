/**
 * La página host del shell contra su propia CSP. La CSP (style-src y script-src 'self')
 * bloquea en silencio <style> y <script> inline, style="" y on*="": la página carga y
 * el estilo o el handler no se aplica. index.html es donde se escribe ese markup a mano
 * (el aviso de fallo de arranque), así que esto vuelve ruidoso el error.
 * Permitir un <style> por hash no aguanta: el servidor de desarrollo reescribe los
 * estilos inline (les agrega un source map). Ver vault: i18n.md. `npm run test:tools`.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOST_PAGE = 'projects/shell/src/index.html';

export function stripHtmlComments(input) {
  let previous;
  let current = input;
  do {
    previous = current;
    current = current.replace(/<!--[\s\S]*?-->/g, '');
  } while (current !== previous);
  return current;
}

// Sin comentarios, como hace el navegador: también mencionan <style> y la CSP.
const html = stripHtmlComments(await readFile(path.join(ROOT, HOST_PAGE), 'utf8'));
const csp = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html)?.[1];

test('strips nested HTML comments until no opener remains', () => {
  const stripped = stripHtmlComments('<!-- a <!-- b --> c -->');
  assert.doesNotMatch(stripped, /<!--/);
});

test('the CSP stays strict: no unsafe-inline, no unsafe-eval, no hash, no nonce', () => {
  assert.ok(csp, `${HOST_PAGE} has no Content-Security-Policy <meta>`);
  assert.doesNotMatch(csp, /'unsafe-inline'|'unsafe-eval'|'unsafe-hashes'|'sha(256|384|512)-|'nonce-/);
});

test('the host page has nothing inline that the CSP would drop', () => {
  assert.doesNotMatch(html, /<style[\s>]/i, 'inline <style> is blocked: use a stylesheet in public/');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, 'inline <script> is blocked');
  assert.doesNotMatch(html, /<[^>]+\sstyle=/i, 'style="" is blocked');
  assert.doesNotMatch(html, /<[^>]+\son[a-z]+=/i, 'on*="" handlers are blocked: wire them in main.ts');
});

test('every stylesheet the host page links exists in public/', async () => {
  const hrefs = [...html.matchAll(/<link\s[^>]*rel="stylesheet"[^>]*href="([^"]+)"/gi)].map(
    ([, href]) => href,
  );
  assert.ok(hrefs.length > 0, 'expected the startup-failure stylesheet to be linked');
  for (const href of hrefs) {
    await assert.doesNotReject(
      readFile(path.join(ROOT, 'projects/shell/public', href)),
      `${href} is linked from ${HOST_PAGE} but missing from projects/shell/public`,
    );
  }
});
