/**
 * El artefacto de producción servido como en un despliegue: los archivos de dist/shell/browser y,
 * para una ruta sin extensión, index.html. Un archivo que falta es 404, nunca el index.
 * `node tools/e2e/serve.mjs --port 4400`; lo arranca Playwright. Ver vault: Integracion Continua §4.1.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { headersFor } from '../deploy/headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIST = path.join(ROOT, 'dist/shell/browser');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/** Qué archivo responde a un camino de URL: el pedido, o index.html si es una ruta de la app. */
export async function resolveFile(urlPath, root = DIST) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const file = path.resolve(root, `.${decoded}`);
  if (file !== root && !file.startsWith(root + path.sep)) {
    return { status: 403 };
  }
  const found = await stat(file).catch(() => null);
  if (found?.isFile()) {
    return { status: 200, file };
  }
  // Una ruta de la app (`/catalogos/articulos`) no tiene extensión; un chunk que no existe, sí.
  return path.extname(decoded) === '' ? { status: 200, file: path.join(root, 'index.html') } : { status: 404 };
}

/**
 * Sin opciones, `no-store`: las E2E nunca miran una copia vieja. Con `contract`, las cabeceras
 * del contrato de despliegue (tools/deploy/headers.mjs), para verificarlo contra algo servido.
 */
export function createStaticServer({ root = DIST, contract = false } = {}) {
  return createServer(async (request, response) => {
    const url = request.url ?? '/';
    const { status, file } = await resolveFile(url, root);
    if (file === undefined) {
      response.writeHead(status).end();
      return;
    }
    response.writeHead(status, {
      'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      ...(contract ? headersFor(url) : { 'Cache-Control': 'no-store' }),
    });
    createReadStream(file).pipe(response);
  });
}

function main() {
  const at = process.argv.indexOf('--port');
  const port = at === -1 ? 4400 : Number(process.argv[at + 1]);
  const contract = process.argv.includes('--headers');
  createStaticServer({ contract }).listen(port, () =>
    console.log(`dist/shell/browser en http://localhost:${port}${contract ? ' (contrato)' : ''}`),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
