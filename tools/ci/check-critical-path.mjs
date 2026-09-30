/**
 * La ruta crítica de `/`: el cierre de imports estáticos del arranque, el marco y la página de
 * inicio, leído del stats.json del build de producción, contra un techo en crudo. Ver vault:
 * 02-Arquitectura/Integracion Continua.md §4, regla 17.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.join(ROOT, 'dist/shell');

/** El techo, en un solo lugar: kB crudos de JavaScript que `/` carga antes de pintar. */
export const CEILING_KB = 537;

/** Lo que carga `/`: el arranque, el marco (perezoso, pero envuelve toda ruta) y el inicio. */
export const ROUTE_ENTRIES = [
  'projects/shell/src/main.ts',
  'projects/shell/src/app/layout/main-layout.ts',
  'projects/shell/src/app/pages/home.ts',
];

/** Los archivos de salida que `/` necesita: cada entrada y todo lo que importa estáticamente. */
export function criticalPath(metafile, entries = ROUTE_ENTRIES) {
  const { outputs } = metafile;
  const files = new Set();
  const walk = (file) => {
    if (files.has(file)) return;
    files.add(file);
    for (const edge of outputs[file].imports ?? []) {
      if (edge.kind === 'import-statement' && outputs[edge.path] !== undefined) walk(edge.path);
    }
  };
  for (const entry of entries) {
    const file = Object.keys(outputs).find((key) => outputs[key].entryPoint === entry);
    if (file === undefined) {
      throw new Error(`No output file has ${entry} as its entry point: the route changed shape.`);
    }
    walk(file);
  }
  return [...files];
}

function main() {
  const stats = path.join(DIST, 'stats.json');
  if (!existsSync(stats)) {
    console.error('No dist/shell/stats.json: run `npm run build` first (production writes it).');
    process.exitCode = 1;
    return;
  }
  const files = criticalPath(JSON.parse(readFileSync(stats, 'utf8')));
  let raw = 0;
  let gzip = 0;
  for (const file of files) {
    const content = readFileSync(path.join(DIST, 'browser', path.basename(file)));
    raw += content.length;
    gzip += gzipSync(content, { level: 9 }).length;
  }
  const summary =
    `Critical path of /: ${files.length} files, ${(raw / 1000).toFixed(2)} kB raw ` +
    `(${(gzip / 1000).toFixed(2)} kB gzip), ceiling ${CEILING_KB} kB.`;
  if (raw <= CEILING_KB * 1000) {
    console.log(summary);
    return;
  }
  console.error(
    `${summary}\nOver the ceiling. Something eager started pulling a library or a screen: ` +
      'load it with its route, or measure again and change the ceiling on purpose.',
  );
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
