/**
 * Gate 10 -- design tokens.
 *
 * Fails the build when anything under projects/ steps outside the design
 * system (ADR 0005, ADR 0009). Three checks, one exception.
 *
 *   1. Raw values in .css / .html / .ts: hex colours, colour functions
 *      (rgb, rgba, hsl, hsla and their modern siblings) and pixel lengths.
 *
 *   2. Tailwind default utilities. `bg-blue-500` has no hex in it and still
 *      bypasses the whole system. `--*: initial` in styles.css already stops
 *      it from producing CSS -- but Tailwind drops unknown classes silently,
 *      so nothing fails and the class sits in the markup doing nothing.
 *
 *      There is no hand-written list of forbidden names. Every class-like
 *      token is compiled twice: once against stock Tailwind, once against
 *      our styles.css. Producing CSS under stock Tailwind but not under ours
 *      is exactly what a default utility is. `rounded-lg` passes, because
 *      radius/lg is ours; `rounded-xl` does not.
 *
 *   3. Primitive tokens referenced outside tokens.css. Components consume
 *      semantic tokens only; a primitive in a component is what breaks
 *      re-branding (ADR 0007). A primitive is any token in tokens.css whose
 *      value contains no var().
 *
 * The single exception is tokens.css: the one file where raw values are the
 * point. It is excluded by exact path, nothing else is.
 *
 * Run locally with `npm run lint:tokens`.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIR = 'projects';
const EXTENSIONS = new Set(['.css', '.html', '.ts']);
const TOKENS_FILE = 'projects/design-system/src/styles/tokens.css';
const TAILWIND_ENTRY = 'projects/shell/src/styles.css';

const RAW_VALUES = [
  {
    // `&#` and `&` keep HTML entities out; a leading word character keeps
    // identifiers such as `a#fff` out.
    pattern: /(?<![\w&#])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi,
    label: 'hex colour',
  },
  {
    pattern: /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/gi,
    label: 'colour function',
  },
  {
    // The sign is not part of the match, so `-4px` is caught through `4px`.
    pattern: /(?<![\w.])\d*\.?\d+px(?![\w-])/gi,
    label: 'pixel value',
  },
];

// ------------------------------------------------------------------ files

async function listFiles(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...(await listFiles(relative)));
      }
    } else if (EXTENSIONS.has(path.extname(entry.name)) && relative !== TOKENS_FILE) {
      files.push(relative);
    }
  }
  return files;
}

function position(content, index) {
  const before = content.slice(0, index);
  const line = before.split('\n').length;
  const column = index - before.lastIndexOf('\n');
  return { line, column };
}

// --------------------------------------------------------------- tailwind

async function loadStylesheet(id, base) {
  const file =
    id.startsWith('.') || path.isAbsolute(id)
      ? path.resolve(base, id)
      : path.join(ROOT, 'node_modules', id === 'tailwindcss' ? 'tailwindcss/index.css' : id);
  return { path: file, base: path.dirname(file), content: await readFile(file, 'utf8') };
}

/**
 * Returns a predicate telling whether a class name produces any CSS under the
 * given stylesheet. The compiler accumulates candidates, so a candidate that
 * generates something changes the build output and an unknown one does not.
 */
async function utilityProbe(css, base) {
  const compiler = await compile(css, { base, loadStylesheet });
  let previous = compiler.build([]);
  const seen = new Map();
  return (candidate) => {
    if (!seen.has(candidate)) {
      const next = compiler.build([candidate]);
      seen.set(candidate, next !== previous);
      previous = next;
    }
    return seen.get(candidate);
  };
}

/**
 * The parts of a file where a class name can live, with their offsets:
 * attributes of HTML tags (names too, for `[class.foo]`), string literals in
 * TypeScript (inline templates, host bindings, class lists) and `@apply` in
 * CSS. Prose and comments stay out, so a word like "shadow" in a sentence is
 * never mistaken for the utility.
 */
function classSegments(content, extension) {
  const segments = [];
  const collect = (pattern, group = 0) => {
    for (const match of content.matchAll(pattern)) {
      const text = match[group];
      if (text) {
        segments.push({ text, offset: match.index + match[0].indexOf(text) });
      }
    }
  };
  if (extension === '.css') {
    collect(/@apply\s+([^;}]+)/g, 1);
  } else if (extension === '.html') {
    collect(
      /<[a-zA-Z][^\s>/]*((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g,
      1,
    );
  } else {
    collect(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g);
  }
  return segments;
}

/**
 * Class-like tokens with their offsets. Angular `[class.foo]` bindings are
 * unwrapped. Deliberately generous inside a segment: a token that is not a
 * class compiles to nothing under both themes and is never reported.
 */
function candidates(content, extension) {
  const found = [];
  for (const segment of classSegments(content, extension)) {
    found.push(
      ...tokens(segment.text).map(({ token, index }) => ({ token, index: segment.offset + index })),
    );
  }
  return found;
}

function tokens(text) {
  const unwrapped = text.replace(/\[class\./g, (match) => ' '.repeat(match.length));
  const found = [];
  for (const match of unwrapped.matchAll(/[^\s"'`<>={};,]+/g)) {
    let token = match[0];
    let index = match.index;
    while (token.startsWith('.') || token.startsWith('(')) {
      token = token.slice(1);
      index += 1;
    }
    const unbalanced = (open, close) =>
      token.split(open).length < token.split(close).length && token.endsWith(close);
    while (unbalanced('[', ']') || unbalanced('(', ')') || token.endsWith(':')) {
      token = token.slice(0, -1);
    }
    // `--name` is a custom property, never a class.
    if (
      token.length > 1 &&
      token.length <= 120 &&
      /[a-z]/i.test(token) &&
      !token.startsWith('--')
    ) {
      found.push({ token, index });
    }
  }
  return found;
}

// ------------------------------------------------------------------ gate

async function main() {
  const tokensCss = await readFile(path.join(ROOT, TOKENS_FILE), 'utf8');
  const primitives = [...tokensCss.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .filter(([, , value]) => !value.includes('var('))
    .map(([, name]) => name);
  if (primitives.length === 0) {
    throw new Error(`No primitive tokens found in ${TOKENS_FILE}; the gate would be vacuous.`);
  }
  const escaped = primitives.map((name) => name.replace(/[-]/g, '\\-'));
  const primitivePattern = new RegExp(`(?<![\\w-])(?:${escaped.join('|')})(?![\\w-])`, 'g');

  const entry = path.join(ROOT, TAILWIND_ENTRY);
  const isStock = await utilityProbe(`@import 'tailwindcss';`, ROOT);
  const isOurs = await utilityProbe(await readFile(entry, 'utf8'), path.dirname(entry));

  // Fail closed: if the probe stops telling the two themes apart (a Tailwind
  // API change, or `--*: initial` removed from styles.css), check 2 would
  // silently pass everything.
  if (!isStock('bg-blue-500') || isOurs('bg-blue-500')) {
    throw new Error(
      `Tailwind probe is not discriminating: 'bg-blue-500' must compile under stock Tailwind ` +
        `and must NOT compile under ${TAILWIND_ENTRY}. Is \`--*: initial\` still in its @theme?`,
    );
  }

  const violations = [];
  const report = (file, content, index, message) =>
    violations.push({ file, ...position(content, index), message });

  const files = await listFiles(SCAN_DIR);
  for (const file of files) {
    const content = await readFile(path.join(ROOT, file), 'utf8');

    for (const { pattern, label } of RAW_VALUES) {
      for (const match of content.matchAll(pattern)) {
        report(
          file,
          content,
          match.index,
          `raw ${label} \`${match[0]}\`. Use a semantic token from tokens.css; if it is missing, add it there first.`,
        );
      }
    }

    for (const match of content.matchAll(primitivePattern)) {
      report(
        file,
        content,
        match.index,
        `primitive token \`${match[0]}\` used outside tokens.css. Consume the semantic token that aliases it.`,
      );
    }

    for (const { token, index } of candidates(content, path.extname(file))) {
      if (isStock(token) && !isOurs(token)) {
        report(
          file,
          content,
          index,
          `Tailwind default utility \`${token}\`. Its default theme is deleted (ADR 0009): this class ` +
            `applies no style. Use the design-system utility for the role (e.g. bg-primary, ` +
            `text-secondary, rounded-control, p-4).`,
        );
      }
    }
  }

  if (violations.length === 0) {
    console.log(`Design tokens: ${files.length} files clean (tokens.css excluded).`);
    return;
  }

  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
  for (const v of violations) {
    const text = `${v.file}:${v.line}:${v.column} ${v.message}`;
    console.error(
      process.env.GITHUB_ACTIONS
        ? `::error file=${v.file},line=${v.line},col=${v.column}::${v.message}`
        : text,
    );
  }
  console.error(`\nDesign tokens: ${violations.length} violation(s). See ADR 0005 and ADR 0009.`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
