/**
 * Regla 10: tokens de diseño (ADR 0005, ADR 0009). Falla si algo bajo projects/ se sale
 * del sistema. Tres controles:
 *
 *   1. Valores crudos en .css/.html/.ts: hex, funciones de color y px.
 *   2. Utilidades por defecto de Tailwind: no llevan hex y saltean el sistema igual, y
 *      Tailwind descarta en silencio la clase desconocida. Sin lista a mano: cada token
 *      con forma de clase se compila contra Tailwind de fábrica y contra nuestro
 *      styles.css; si genera CSS en el primero y no en el nuestro, es una por defecto.
 *   3. Primitivos fuera de tokens.css (ADR 0007): primitivo es un token sin var().
 *
 * Excepciones por ruta exacta: tokens.css, y startup-failure.css, que se pinta cuando la
 * app no arrancó y no puede leer tokens.css; ahí solo pasan valores que tokens.css define
 * como primitivo (i18n.md, «Cuando el diccionario no carga»). `npm run lint:tokens`.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseTemplate, TmplAstRecursiveVisitor, tmplAstVisitAll } from '@angular/compiler';
import { compile } from 'tailwindcss';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIR = 'projects';
const EXTENSIONS = new Set(['.css', '.html', '.ts']);
const TOKENS_FILE = 'projects/design-system/src/styles/tokens.css';
const TAILWIND_ENTRY = 'projects/shell/src/styles.css';
const TOKEN_VALUES_ONLY = new Set(['projects/shell/public/startup-failure.css']);

const RAW_VALUES = [
  {
    // `&#` y `&` dejan afuera las entidades HTML; un carácter de palabra antes deja
    // afuera identificadores como `a#fff`.
    pattern: /(?<![\w&#])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi,
    label: 'hex colour',
    comparable: true,
  },
  {
    pattern: /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/gi,
    label: 'colour function',
    comparable: false,
  },
  {
    // El signo no entra en la coincidencia: `-4px` se atrapa por `4px`.
    pattern: /(?<![\w.])\d*\.?\d+px(?![\w-])/gi,
    label: 'pixel value',
    comparable: true,
  },
];

// ----------------------------------------------------------------- archivos

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
 * Predicado: si una clase genera CSS con esa hoja. El compilador acumula candidatos, así
 * que uno que genera algo cambia la salida y uno desconocido no.
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
 * Las partes de un archivo donde puede vivir una clase, con su offset: atributos e inputs
 * en HTML de Angular, literales en TypeScript y `@apply` en CSS. En HTML la prosa queda
 * afuera; en TypeScript entra todo literal entre comillas o backticks, comentarios incluidos.
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
    const parsed = parseTemplate(content, 'design-tokens.html', { preserveWhitespaces: false });
    classSegmentsFromNodes(parsed.nodes, segments);
  } else {
    collect(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g);
  }
  return segments;
}

class ClassSegmentVisitor extends TmplAstRecursiveVisitor {
  constructor(segments) {
    super();
    this.segments = segments;
  }

  add(value, source) {
    if (typeof value === 'string' && value) {
      this.segments.push({ text: value, offset: source?.start.offset ?? 0 });
    }
  }

  visitElement(element) {
    if (element.name === 'code' || element.name === 'pre') return;
    this.visitAttributes(element);
    super.visitElement(element);
  }

  visitTemplate(template) {
    this.visitAttributes(template);
    super.visitTemplate(template);
  }

  visitAttributes(node) {
    for (const attribute of node.attributes ?? []) {
      this.add(attribute.value, attribute.valueSpan);
    }
    for (const input of node.inputs ?? []) {
      if (input.keySpan?.details?.startsWith('class.')) {
        this.add(input.name, input.keySpan);
      }
      this.add(input.value?.source, input.value?.sourceSpan);
    }
  }
}

function classSegmentsFromNodes(nodes, segments) {
  tmplAstVisitAll(new ClassSegmentVisitor(segments), nodes);
}

/**
 * Tokens con forma de clase y su offset; desenvuelve `[class.foo]`. Generoso a propósito:
 * lo que no es clase no compila con ninguno de los dos temas y nunca se reporta.
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

export function classCandidates(content, extension) {
  return candidates(content, extension).map(({ token }) => token);
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
    // `--name` es una propiedad personalizada, nunca una clase.
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

export function rawValueMatches(content) {
  return RAW_VALUES.flatMap(({ pattern, label }) =>
    [...content.matchAll(pattern)].map((match) => ({ value: match[0], label, index: match.index })),
  );
}

const ANY_TOKEN = /(?<![\w-])--[\w-]+(?![\w-])/g;

export function primitiveTokenMatches(content, primitiveNames) {
  const names = new Set(primitiveNames);
  return [...content.matchAll(ANY_TOKEN)]
    .filter((match) => names.has(match[0]))
    .map((match) => ({ value: match[0], index: match.index }));
}

// -------------------------------------------------------------- compuerta

async function main() {
  const tokensCss = await readFile(path.join(ROOT, TOKENS_FILE), 'utf8');
  const primitiveDeclarations = [...tokensCss.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].filter(
    ([, , value]) => !value.includes('var('),
  );
  const primitives = primitiveDeclarations.map(([, name]) => name);
  const primitiveValues = new Set(
    primitiveDeclarations.map(([, , value]) => value.trim().toLowerCase()),
  );
  if (primitives.length === 0) {
    throw new Error(`No primitive tokens found in ${TOKENS_FILE}; the gate would be vacuous.`);
  }
  const entry = path.join(ROOT, TAILWIND_ENTRY);
  const isStock = await utilityProbe(`@import 'tailwindcss';`, ROOT);
  const isOurs = await utilityProbe(await readFile(entry, 'utf8'), path.dirname(entry));

  // Falla cerrado: si la sonda deja de distinguir los dos temas (cambio de API de
  // Tailwind, o se quitó `--*: initial` de styles.css), el control 2 dejaría pasar todo.
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

    for (const match of rawValueMatches(content)) {
      const comparable = RAW_VALUES.find(({ label }) => label === match.label).comparable;
      if (
        TOKEN_VALUES_ONLY.has(file) &&
        comparable &&
        primitiveValues.has(match.value.toLowerCase())
      ) {
        continue;
      }
      report(
        file,
        content,
        match.index,
        `raw ${match.label} \`${match.value}\`. Use a semantic token from tokens.css; if it is missing, add it there first.`,
      );
    }

    for (const match of primitiveTokenMatches(content, primitives)) {
      report(
        file,
        content,
        match.index,
        `primitive token \`${match.value}\` used outside tokens.css. Consume the semantic token that aliases it.`,
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
    console.log(
      `Design tokens: ${files.length} files clean (tokens.css excluded; ` +
        `limited to tokens.css values: ${[...TOKEN_VALUES_ONLY].join(', ')}).`,
    );
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
