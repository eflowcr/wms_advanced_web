/**
 * Regla 16: un bloque de comentario tiene tres líneas de texto como máximo; el porqué largo va al
 * vault. Mira todo el repositorio; `--base <ref>` se limita a lo creado o tocado desde el ancestro.
 * Ver vault: 02-Arquitectura/Integracion Continua.md §4, regla 16.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MAX_TEXT_LINES = 3;

// Generados: los reescribe una herramienta y ningún humano los lee como fuente.
const GENERATED = new Set(['projects/design-system/src/icons/icons.generated.ts']);

const SLASH_SYNTAX = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json']);
const MARKUP_SYNTAX = new Set(['.html', '.svg', '.xml']);
const HASH_SYNTAX = /(?:^|\/)(?:\.npmrc|\.gitignore)$|\.ya?ml$|^\.githooks\//;

/** Cómo comenta un archivo: `slash`, `css`, `markup`, `hash`, o `null` si la regla no lo mira. */
export function syntaxOf(file) {
  const name = file.replaceAll('\\', '/');
  if (GENERATED.has(name)) return null;
  if (HASH_SYNTAX.test(name)) return 'hash';
  const extension = path.extname(name);
  if (SLASH_SYNTAX.has(extension)) return 'slash';
  if (extension === '.css') return 'css';
  if (MARKUP_SYNTAX.has(extension)) return 'markup';
  return null;
}

// -------------------------------------------------------------------- lectura

const REGEX_AFTER = new Set([...'(,=:[!&|?{};+-*%<>~^']);
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|case|do|else|in|of|new|delete|void|throw|yield|await)$/;

/**
 * Los comentarios de un fuente con sintaxis de barras, saltando cadenas, plantillas y regex.
 * Cada uno: `{ kind: 'line' | 'block', start, end, text, alone }`, líneas desde 1.
 */
function slashComments(content, { lineComments = true, regex = true } = {}) {
  const found = [];
  let line = 1;
  let i = 0;
  let lastSignificant = '';
  let lineHasCode = false;
  const templateDepth = [];
  const n = content.length;

  const advance = (to) => {
    for (; i < to; i++) {
      if (content[i] === '\n') {
        line++;
        lineHasCode = false;
      }
    }
  };

  while (i < n) {
    const c = content[i];
    const next = content[i + 1];
    if (c === '\n') {
      advance(i + 1);
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    if (c === '/' && next === '/' && lineComments) {
      const endOfLine = content.indexOf('\n', i);
      const stop = endOfLine === -1 ? n : endOfLine;
      found.push({ kind: 'line', start: line, end: line, text: content.slice(i + 2, stop), alone: !lineHasCode });
      i = stop;
      continue;
    }
    if (c === '/' && next === '*') {
      const close = content.indexOf('*/', i + 2);
      const stop = close === -1 ? n : close + 2;
      const start = line;
      const alone = !lineHasCode;
      const text = content.slice(i + 2, close === -1 ? n : close);
      advance(stop);
      found.push({ kind: 'block', start, end: line, text, alone });
      continue;
    }
    lineHasCode = true;
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && content[j] !== c && content[j] !== '\n') j += content[j] === '\\' ? 2 : 1;
      advance(Math.min(j + 1, n));
      lastSignificant = c;
      continue;
    }
    if (c === '`') {
      i = skipTemplate(i + 1);
      lastSignificant = '`';
      continue;
    }
    if (c === '}' && templateDepth.length > 0 && templateDepth.at(-1) === 0) {
      templateDepth.pop();
      i = skipTemplate(i + 1);
      lastSignificant = '`';
      continue;
    }
    if (c === '{' && templateDepth.length > 0) templateDepth[templateDepth.length - 1]++;
    if (c === '}' && templateDepth.length > 0) templateDepth[templateDepth.length - 1]--;
    if (c === '/' && regex && regexAllowed(content, i, lastSignificant)) {
      i = skipRegex(i + 1);
      lastSignificant = '/';
      continue;
    }
    lastSignificant = c;
    i++;
  }
  return found;

  // Hasta el cierre de la plantilla, o hasta `${`, que vuelve al código con una profundidad más.
  function skipTemplate(from) {
    let j = from;
    while (j < n) {
      if (content[j] === '\\') {
        j += 2;
      } else if (content[j] === '`') {
        advance(j + 1);
        return j + 1;
      } else if (content[j] === '$' && content[j + 1] === '{') {
        templateDepth.push(0);
        advance(j + 2);
        return j + 2;
      } else {
        j++;
      }
    }
    advance(n);
    return n;
  }

  function skipRegex(from) {
    let j = from;
    let inClass = false;
    while (j < n && content[j] !== '\n') {
      const ch = content[j];
      if (ch === '\\') j += 2;
      else if (ch === '[') (inClass = true), j++;
      else if (ch === ']') (inClass = false), j++;
      else if (ch === '/' && !inClass) {
        j++;
        while (j < n && /[a-z]/i.test(content[j])) j++;
        advance(j);
        return j;
      } else j++;
    }
    advance(j);
    return j;
  }
}

function regexAllowed(content, index, lastSignificant) {
  if (lastSignificant === '' || REGEX_AFTER.has(lastSignificant)) return true;
  return REGEX_KEYWORDS.test(content.slice(Math.max(0, index - 12), index).trimEnd());
}

function markupComments(content) {
  const found = [];
  for (const match of content.matchAll(/<!--([\s\S]*?)-->/g)) {
    const start = content.slice(0, match.index).split('\n').length;
    const end = start + match[0].split('\n').length - 1;
    found.push({ kind: 'block', start, end, text: match[1], alone: true });
  }
  return found;
}

function hashComments(content) {
  const found = [];
  content.split('\n').forEach((raw, index) => {
    const text = raw.trimStart();
    if (text.startsWith('#') && !(index === 0 && text.startsWith('#!'))) {
      found.push({ kind: 'line', start: index + 1, end: index + 1, text: text.replace(/^#+/, ''), alone: true });
    }
  });
  return found;
}

// ------------------------------------------------------------------ bloques

/** Las líneas de prosa de un comentario, sin delimitadores ni el `*` de cada línea de JSDoc. */
function proseLines(comment) {
  const lines = comment.text.split('\n').map((raw) =>
    raw
      .replace(/\r$/, '')
      .replace(/^\s*\*(?!\/)/, '')
      .trim(),
  );
  return lines;
}

/** Quita las líneas de un marcador `t(…)` que lee transloco-keys-manager: no son prosa. */
function withoutMarkers(lines) {
  const kept = [];
  let depth = 0;
  for (const line of lines) {
    if (depth === 0 && !/^t\(/.test(line)) {
      kept.push(line);
      continue;
    }
    for (const ch of line) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
    }
    depth = Math.max(depth, 0);
  }
  return kept;
}

/**
 * Los bloques de comentario de un archivo: líneas `//` o `#` seguidas, o un `/* … *\/` o un
 * `<!-- … -->`. Cada uno con su primera y última línea y cuántas tienen texto.
 */
export function commentBlocks(content, file) {
  const syntax = syntaxOf(file);
  if (syntax === null) return [];
  const comments =
    syntax === 'slash'
      ? slashComments(content, { regex: path.extname(file) !== '.json' })
      : syntax === 'css'
        ? slashComments(content, { lineComments: false, regex: false })
        : syntax === 'markup'
          ? markupComments(content)
          : hashComments(content);

  const blocks = [];
  for (const comment of comments) {
    const previous = blocks.at(-1);
    const continues =
      previous !== undefined &&
      comment.kind === 'line' &&
      previous.kind === 'line' &&
      comment.alone &&
      comment.start === previous.end + 1;
    if (continues) {
      previous.end = comment.end;
      previous.lines.push(...proseLines(comment));
    } else {
      blocks.push({ kind: comment.kind, start: comment.start, end: comment.end, lines: proseLines(comment) });
    }
  }
  return blocks.map(({ start, end, lines }) => ({
    start,
    end,
    textLines: withoutMarkers(lines).filter((text) => text.length > 0).length,
  }));
}

export function longBlocks(content, file) {
  return commentBlocks(content, file).filter((block) => block.textLines > MAX_TEXT_LINES);
}

// --------------------------------------------------------------------- git

/** Líneas nuevas o tocadas por archivo, de un `git diff -U0`; un borrado marca dónde ocurrió. */
export function changedLines(diff) {
  const changed = new Map();
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line === '+++ /dev/null' ? null : line.slice(6);
      if (file !== null && !changed.has(file)) changed.set(file, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file !== null) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      const lines = changed.get(file);
      if (count === 0) {
        lines.add(start);
        lines.add(start + 1);
      }
      for (let k = 0; k < count; k++) lines.add(start + k);
    }
  }
  return changed;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function listFiles(cwd) {
  const tracked = git(['ls-files', '-z'], cwd).split('\0');
  const untracked = git(['ls-files', '-z', '--others', '--exclude-standard'], cwd).split('\0');
  return [...new Set([...tracked, ...untracked])].filter((file) => file && syntaxOf(file) !== null);
}

/** Los bloques largos: todos, o solo los creados o tocados desde el ancestro común con `base`. */
export function findLongBlocks({ cwd = ROOT, base = null } = {}) {
  let scope = null;
  if (base !== null) {
    const ancestor = git(['merge-base', base, 'HEAD'], cwd).trim();
    scope = changedLines(git(['diff', '-U0', '--no-color', '--no-ext-diff', ancestor, '--'], cwd));
    for (const file of git(['ls-files', '-z', '--others', '--exclude-standard'], cwd).split('\0')) {
      if (file) scope.set(file, null);
    }
  }
  const files = scope === null ? listFiles(cwd) : [...scope.keys()].filter((file) => syntaxOf(file) !== null);
  const found = [];
  for (const file of files.sort()) {
    const full = path.join(cwd, file);
    if (!existsSync(full)) continue;
    const touched = scope?.get(file);
    for (const block of longBlocks(readFileSync(full, 'utf8'), file)) {
      let inScope = touched === undefined || touched === null;
      for (let lineNo = block.start; !inScope && lineNo <= block.end; lineNo++) {
        inScope = touched.has(lineNo);
      }
      if (inScope) found.push({ file, ...block });
    }
  }
  return found;
}

// --------------------------------------------------------------- compuerta

function main() {
  const at = process.argv.indexOf('--base');
  const base = at === -1 ? null : process.argv[at + 1];
  const found = findLongBlocks({ base });
  const message = (block) =>
    `comment block of ${block.textLines} lines (max ${MAX_TEXT_LINES}). Keep the fact, move the why ` +
    `to the vault and leave one line with the link.`;

  const scope = base === null ? 'in the repository' : `created or touched since ${base}`;
  if (found.length === 0) {
    console.log(`Comments: no block over ${MAX_TEXT_LINES} lines ${scope}.`);
    return;
  }
  for (const block of found) {
    console.error(
      process.env.GITHUB_ACTIONS
        ? `::error file=${block.file},line=${block.start}::${message(block)}`
        : `${block.file}:${block.start} ${message(block)}`,
    );
  }
  console.error(`\nComments: ${found.length} block(s) over ${MAX_TEXT_LINES} lines ${scope}.`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
