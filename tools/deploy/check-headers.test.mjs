// El contrato de despliegue, probado contra el servidor estático de las E2E: sin el contrato no
// cumple, con `--headers` responde el contrato escrito. Necesita dist/. Ver vault: Contrato de despliegue.
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from '../e2e/serve.mjs';
import { checkHeaders } from './check-headers.mjs';
import { cacheControlFor, HASHED, metaCsp, securityHeaders } from './headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * El contrato de la nota Contrato de despliegue, letra por letra: el servidor y headers.mjs se
 * comparan con esto, no con la función que los configura.
 */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; " +
  "connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; " +
  "require-trusted-types-for 'script'; trusted-types 'none'";
const EVERY_RESPONSE = {
  'content-security-policy': `${CSP}; frame-ancestors 'none'`,
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=()',
};
const FOR_GOOD = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

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

  it('the same server with --headers answers the written contract, header by header', async () => {
    const server = await served({ contract: true });
    servers.push(server);
    const html = await (await fetch(new URL('/', server.base))).text();
    const script = /<script[^>]+src="([^"]+\.js)"/i.exec(html)?.[1];
    assert.ok(script, 'the served index.html loads no script');

    const cache = {
      '/': REVALIDATE,
      '/catalogos/articulos': REVALIDATE,
      '/config.json': REVALIDATE,
      [`/${script}`]: FOR_GOOD,
      '/i18n/es.json?v=0123456789': FOR_GOOD,
      '/i18n/es.json': REVALIDATE,
      '/fonts/montserrat-latin-wght-normal.woff2': REVALIDATE,
    };
    for (const [url, cacheControl] of Object.entries(cache)) {
      const response = await fetch(new URL(url, server.base));
      for (const [name, value] of Object.entries({ ...EVERY_RESPONSE, 'cache-control': cacheControl })) {
        assert.equal(response.headers.get(name), value, `${url} ${name}`);
      }
    }
  });

  it('and the checker finds nothing to say about it', async () => {
    const server = await served({ contract: true });
    servers.push(server);

    assert.deepEqual(await checkHeaders(server.base), []);
  });
});

describe('what headers.mjs writes is the written contract', () => {
  it('caches for good only what changes name when it changes', () => {
    assert.equal(cacheControlFor('/main-FLLS5WLX.js'), FOR_GOOD);
    assert.equal(cacheControlFor('/chunk-DpUzT79-.js'), FOR_GOOD);
    assert.equal(cacheControlFor('/styles-ABCD1234.css'), FOR_GOOD);
    assert.equal(cacheControlFor('/i18n/showroom/es.json?v=0123456789'), FOR_GOOD);
    for (const url of ['/', '/catalogos/articulos', '/index.html', '/config.json', '/i18n/es.json']) {
      assert.equal(cacheControlFor(url), REVALIDATE, url);
    }
    assert.equal(cacheControlFor('/fonts/montserrat-latin-wght-normal.woff2'), REVALIDATE);
    assert.equal(cacheControlFor('/startup-failure.css'), REVALIDATE);
  });

  it('the CSP of index.html and of the header are the written ones', () => {
    assert.equal(metaCsp(), CSP);
    assert.deepEqual(securityHeaders(), EVERY_RESPONSE);
  });

  it('nothing in public/ is named like a hashed build file, or it would be cached for good', async () => {
    const files = await readdir(path.join(ROOT, 'projects/shell/public'), { recursive: true });
    const hashedLooking = files.map((file) => `/${file.replace(/\\/g, '/')}`).filter((file) => HASHED.test(file));

    assert.deepEqual(hashedLooking, []);
  });
});
