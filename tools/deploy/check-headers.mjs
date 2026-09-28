/**
 * Verifica el contrato de despliegue contra un sitio servido: `node tools/deploy/check-headers.mjs
 * --url https://…`. Pide index.html, una ruta, config.json, un chunk, un diccionario con y sin `?v=`
 * y una fuente, y compara cada cabecera. Entra a CI el día que haya un ambiente (vault, Contrato).
 */
import { pathToFileURL } from 'node:url';
import { headersFor } from './headers.mjs';

/** Las URL que se piden: una de cada tipo de caché, sacadas de la propia página servida. */
export async function sampleUrls(base) {
  const html = await (await fetch(new URL('/', base))).text();
  const script = /<script[^>]+src="([^"]+\.js)"/i.exec(html)?.[1];
  return [
    '/',
    '/catalogos/articulos',
    '/config.json',
    ...(script ? [`/${script}`] : []),
    // El contrato mira si hay `?v=`, no cuál: el servidor no conoce las huellas.
    '/i18n/es.json?v=0123456789',
    '/i18n/es.json',
    '/fonts/montserrat-latin-wght-normal.woff2',
  ];
}

/** Las diferencias entre lo que el sitio responde y lo que el contrato pide; vacío si cumple. */
export async function checkHeaders(base) {
  const problems = [];
  for (const url of await sampleUrls(base)) {
    const response = await fetch(new URL(url, base));
    for (const [name, expected] of Object.entries(headersFor(url))) {
      const actual = response.headers.get(name);
      if (actual !== expected) {
        problems.push(`${url} ${name}: expected «${expected}», got «${actual ?? '(missing)'}»`);
      }
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf('--url');
  const base = at === -1 ? undefined : process.argv[at + 1];
  if (!base) {
    console.error('usage: node tools/deploy/check-headers.mjs --url <base url>');
    process.exitCode = 2;
  } else {
    const problems = await checkHeaders(base);
    problems.forEach((problem) => console.error(problem));
    console.log(problems.length ? `${problems.length} header(s) off contract.` : 'Headers: on contract.');
    process.exitCode = problems.length ? 1 : 0;
  }
}
