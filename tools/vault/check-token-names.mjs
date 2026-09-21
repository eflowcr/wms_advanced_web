/**
 * Lista los nombres --color-* citados en el vault que tokens.css no define. No es
 * compuerta de CI: el vault no está en este repo. Se corre a mano antes de dar por
 * cerrada una ficha, porque un nombre que no existe se pudre en silencio.
 *
 *   npm run vault:check-tokens -- <ruta-al-vault> [--exclude <dir>]...
 *
 * Recorre los .md salteando carpetas ocultas y 99-Archivo (historia por definición).
 * Un nombre dentro de una frase que narra historia se lista igual: se decide leyendo.
 * Salida: 0 si todo existe, 1 si no, 2 ante un uso incorrecto.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKENS_FILE = 'projects/design-system/src/styles/tokens.css';
const ALWAYS_SKIPPED = new Set(['99-Archivo']);

/**
 * Un nombre --color-* entero. El lookbehind deja afuera variables del tema de Tailwind
 * como --background-color-primary; el lookahead, comodines y marcadores.
 */
const COLOR_TOKEN = /(?<![\w-])--color-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w*<-])/g;

/** Nombres definidos en tokens.css (`--color-x: ...;`). */
export function definedColorTokens(css) {
  return new Set([...css.matchAll(/^\s*(--color-[\w-]+)\s*:/gm)].map((match) => match[1]));
}

/** Cada nombre --color-* citado en un Markdown, con su línea. */
export function citedColorTokens(markdown) {
  const cited = [];
  markdown.split('\n').forEach((text, index) => {
    for (const match of text.matchAll(COLOR_TOKEN)) {
      cited.push({ name: match[0], line: index + 1 });
    }
  });
  return cited;
}

async function listMarkdown(vault, dir, excluded) {
  const entries = await readdir(path.join(vault, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && !ALWAYS_SKIPPED.has(entry.name) && !excluded.has(relative)) {
        files.push(...(await listMarkdown(vault, relative, excluded)));
      }
    } else if (entry.name.endsWith('.md')) {
      files.push(relative);
    }
  }
  return files;
}

function parseArguments(argv) {
  const excluded = new Set();
  let vault;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--exclude') {
      const dir = argv[++index];
      if (!dir) return undefined;
      excluded.add(dir.replace(/\\/g, '/').replace(/\/+$/, ''));
    } else if (vault === undefined) {
      vault = argument;
    } else {
      return undefined;
    }
  }
  return vault === undefined ? undefined : { vault: path.resolve(vault), excluded };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options) {
    console.error('Usage: npm run vault:check-tokens -- <path-to-vault> [--exclude <dir>]...');
    process.exitCode = 2;
    return;
  }

  const defined = definedColorTokens(await readFile(path.join(ROOT, TOKENS_FILE), 'utf8'));
  const files = await listMarkdown(options.vault, '', options.excluded);

  const missing = [];
  for (const file of files.sort()) {
    const markdown = await readFile(path.join(options.vault, file), 'utf8');
    for (const { name, line } of citedColorTokens(markdown)) {
      if (!defined.has(name)) {
        missing.push(`${file}:${line}  ${name}`);
      }
    }
  }

  console.log(
    `Vault token names: ${files.length} notes scanned against ${defined.size} --color-* tokens in ${TOKENS_FILE}.`,
  );
  if (missing.length === 0) {
    console.log('Vault token names: every cited --color-* name exists.');
    return;
  }
  console.log(`Vault token names: ${missing.length} cited name(s) not defined in tokens.css:`);
  for (const entry of missing) {
    console.log(`  ${entry}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
}
