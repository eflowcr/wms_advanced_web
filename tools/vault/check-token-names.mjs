/**
 * Lists the --color-* token names cited in the documentation vault that
 * tokens.css does not define.
 *
 * NOT A CI GATE. The vault is not in this repository, so the runner cannot
 * see it. This is a tool to run by hand before calling a component spec done:
 * a spec names tokens (it never copies values), and a name that does not exist
 * rots silently. Comparing the two lists catches every one at once.
 *
 *   npm run vault:check-tokens -- <path-to-vault> [--exclude <dir>]...
 *
 * Scans every .md file under the vault, skipping hidden directories
 * (.obsidian, .claude) and 99-Archivo (archived notes are history by
 * definition). `--exclude` skips more directories, relative to the vault.
 *
 * A name inside a sentence that narrates history (a token that was replaced)
 * is still listed: the tool does not read prose. Decide by reading the line.
 *
 * Exit code: 0 when every cited name exists, 1 otherwise, 2 on bad usage.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKENS_FILE = 'projects/design-system/src/styles/tokens.css';
const ALWAYS_SKIPPED = new Set(['99-Archivo']);

/**
 * A whole --color-* name. The lookbehind keeps Tailwind theme variables such as
 * --background-color-primary out; the lookahead drops wildcards and
 * placeholders (`--color-neutral-*`, `--color-<familia>-solid`).
 */
const COLOR_TOKEN = /(?<![\w-])--color-[a-z0-9]+(?:-[a-z0-9]+)*(?![\w*<-])/g;

/** Names defined in tokens.css (`--color-x: ...;`). */
export function definedColorTokens(css) {
  return new Set([...css.matchAll(/^\s*(--color-[\w-]+)\s*:/gm)].map((match) => match[1]));
}

/** Every --color-* name cited in a Markdown text, with its line. */
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
