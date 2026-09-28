/**
 * El contrato de despliegue en datos: qué cabeceras lleva cada respuesta. Lo lee el verificador
 * (`check-headers.mjs --url …`) y el servidor estático de las E2E con `--headers`. Quién las pone
 * en producción, **(pendiente, CTO)**. Ver vault: 02-Arquitectura/Contrato de despliegue.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** La CSP del `<meta>` de index.html: la de la cabecera es la misma, más lo que el meta no admite. */
export function metaCsp(root = ROOT) {
  const html = readFileSync(path.join(root, 'projects/shell/src/index.html'), 'utf8');
  const csp = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html)?.[1];
  if (!csp) {
    throw new Error('index.html has no Content-Security-Policy <meta>');
  }
  return csp;
}

/** Las que van en toda respuesta, sin importar el archivo. */
export function securityHeaders(root = ROOT) {
  return {
    'content-security-policy': `${metaCsp(root)}; frame-ancestors 'none'`,
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'permissions-policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=()',
  };
}

export const NO_CACHE = 'no-cache';
export const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Lo que el build nombra con huella (`main-FLLS5WLX.js`, `chunk-DpUzT79-.js`); `public/` no lo usa. */
export const HASHED = /^\/(?:main|chunk|polyfills|styles)-[\w-]+\.(?:js|css)$/;

/**
 * La caché según qué es: con huella, inmutable; un diccionario pedido con `?v=` (ADR 0018), también;
 * index.html, config.json y todo lo que no cambia de nombre al cambiar, `no-cache` (revalida).
 */
export function cacheControlFor(url) {
  const { pathname, searchParams } = new URL(url, 'http://contract.local');
  if (HASHED.test(pathname)) {
    return IMMUTABLE;
  }
  if (/^\/i18n\/.+\.json$/.test(pathname) && searchParams.has('v')) {
    return IMMUTABLE;
  }
  return NO_CACHE;
}

/** Todas las cabeceras que el contrato pide para una URL del sitio. */
export function headersFor(url, root = ROOT) {
  return { ...securityHeaders(root), 'cache-control': cacheControlFor(url) };
}
