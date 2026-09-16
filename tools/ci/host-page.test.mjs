/**
 * The shell's host page against its own CSP.
 *
 * The CSP (style-src 'self', script-src 'self') blocks inline <style>,
 * inline <script>, style="" and on*="" -- silently: the page loads, and the
 * style or the handler simply does not apply. index.html is the one page
 * where people write that kind of markup by hand (the startup-failure notice
 * lives there), so this makes the mistake loud instead of invisible.
 *
 * Allowing an inline <style> by hash was tried and does not hold: the dev
 * server rewrites inline styles (it appends a source map), so the hash never
 * matches there. Styles for the host page go in a file under public/.
 *
 * Run with `npm run test:tools` (part of `npm test`).
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

// Comments dropped, as the browser does: they mention <style> and CSP too.
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
