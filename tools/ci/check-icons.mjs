/**
 * Regla 11: iconos (ADR 0011). Dos controles, los dos bloqueantes.
 *
 *   1. icons.generated.ts está al día: se regenera en memoria con build-icons.mjs y se
 *      compara byte a byte con el versionado, como un lockfile. Se arregla con
 *      `npm run icons:build`, nunca a mano.
 *   2. Ningún <svg> escrito a mano en una plantilla (.html y .ts bajo projects/): todo
 *      icono pasa por <ewms-icon>. Solo se permiten las fuentes de iconos y el componente
 *      que los pinta. Los .svg estáticos (logos) no son plantillas y no se escanean.
 *
 * `npm run lint:icons`.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIcons, OUTPUT } from '../icons/build-icons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIR = 'projects';
const EXTENSIONS = new Set(['.html', '.ts']);
const ALLOWED_DIRS = ['projects/design-system/src/icons/', 'projects/design-system/src/lib/icon/'];
const SVG_TAG = /<svg\b/gi;

async function listFiles(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...(await listFiles(relative)));
      }
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relative);
    }
  }
  return files;
}

function error(file, line, message) {
  console.error(
    process.env.GITHUB_ACTIONS
      ? `::error file=${file}${line ? `,line=${line}` : ''}::${message}`
      : `${file}${line ? `:${line}` : ''} ${message}`,
  );
}

async function checkGenerated() {
  const { source: expected, count } = await buildIcons();
  let committed;
  try {
    committed = await readFile(path.join(ROOT, OUTPUT));
  } catch {
    error(OUTPUT, 0, 'is missing. Run `npm run icons:build` and commit the result.');
    return false;
  }
  if (!committed.equals(Buffer.from(expected, 'utf8'))) {
    const text = committed.toString('utf8');
    const hint = text.includes('\r\n')
      ? ' The committed file has CRLF line endings; .gitattributes pins it to LF.'
      : '';
    error(
      OUTPUT,
      0,
      `is out of sync with the manifest, the custom SVGs or @tabler/icons. ` +
        `Run \`npm run icons:build\` and commit the result; never edit it by hand.${hint}`,
    );
    return false;
  }
  console.log(`Icons: ${OUTPUT} in sync (${count} icons).`);
  return true;
}

async function checkLooseSvg() {
  const files = (await listFiles(SCAN_DIR)).filter(
    (file) => !ALLOWED_DIRS.some((dir) => file.startsWith(dir)),
  );
  let violations = 0;
  for (const file of files) {
    const content = await readFile(path.join(ROOT, file), 'utf8');
    for (const match of content.matchAll(SVG_TAG)) {
      const line = content.slice(0, match.index).split('\n').length;
      error(
        file,
        line,
        'hand-written <svg> in a template. Use <ewms-icon name="..."> from @ewms/design-system; ' +
          'if the icon does not exist, add it to icons.manifest.json (ADR 0011).',
      );
      violations += 1;
    }
  }
  if (violations === 0) {
    console.log(`Icons: no loose <svg> in ${files.length} template/source files.`);
    return true;
  }
  return false;
}

async function main() {
  const inSync = await checkGenerated();
  const noLooseSvg = await checkLooseSvg();
  if (!inSync || !noLooseSvg) {
    console.error('\nIcons: gate failed. See ADR 0011.');
    process.exitCode = 1;
  }
}

main().catch((reason) => {
  console.error(reason instanceof Error ? reason.message : reason);
  process.exitCode = 1;
});
