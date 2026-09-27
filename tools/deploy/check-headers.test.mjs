// El contrato de despliegue, probado contra el servidor estático de las E2E: sin el contrato no
// cumple, con `--headers` sí. Necesita dist/ (ci.yml construye antes). Ver vault: Contrato de despliegue.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from '../e2e/serve.mjs';
import { checkHeaders } from './check-headers.mjs';
import { cacheControlFor, HASHED, IMMUTABLE, metaCsp, NO_CACHE, securityHeaders } from './headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** El servidor en un puerto libre; `close` lo apaga. */
async function served(options) {
  const server = createStaticServer(options);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  return { base: `http://localhost:${port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

describe('the deployment contract, against a served build', () => {
  const servers = [];
  after(() => Promise.all(servers.map((server) => server.close())));

  it('the E2E server, which serves no-store and nothing else, is off contract', async () => {
    const server = await served({});
    servers.push(server);

    const problems = await checkHeaders(server.base);

    assert.ok(problems.some((problem) => /strict-transport-security/.test(problem)));
    assert.ok(problems.some((problem) => /cache-control/.test(problem)));
  });

  it('the same server with --headers meets it, file by file', async () => {
    const server = await served({ contract: true });
    servers.push(server);

    assert.deepEqual(await checkHeaders(server.base), []);
  });
});

describe('what the contract asks for', () => {
  it('caches for good only what changes name when it changes', () => {
    assert.equal(cacheControlFor('/main-FLLS5WLX.js'), IMMUTABLE);
    assert.equal(cacheControlFor('/chunk-DpUzT79-.js'), IMMUTABLE);
    assert.equal(cacheControlFor('/styles-ABCD1234.css'), IMMUTABLE);
    assert.equal(cacheControlFor('/i18n/showroom/es.json?v=0123456789'), IMMUTABLE);
    for (const url of ['/', '/catalogos/articulos', '/index.html', '/config.json', '/i18n/es.json']) {
      assert.equal(cacheControlFor(url), NO_CACHE, url);
    }
    assert.equal(cacheControlFor('/fonts/montserrat-latin-wght-normal.woff2'), NO_CACHE);
    assert.equal(cacheControlFor('/startup-failure.css'), NO_CACHE);
  });

  it('the header CSP is the meta CSP, plus the frame-ancestors a meta cannot carry', () => {
    assert.equal(securityHeaders()['content-security-policy'], `${metaCsp()}; frame-ancestors 'none'`);
  });

  it('nothing in public/ is named like a hashed build file, or it would be cached for good', async () => {
    const files = await readdir(path.join(ROOT, 'projects/shell/public'), { recursive: true });
    const hashedLooking = files.map((file) => `/${file.replace(/\\/g, '/')}`).filter((file) => HASHED.test(file));

    assert.deepEqual(hashedLooking, []);
  });
});
