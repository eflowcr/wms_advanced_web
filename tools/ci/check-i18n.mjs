/**
 * Regla 12: i18n (ADR 0008). Cuatro controles, todos bloqueantes.
 *
 *   1. Claves usadas contra definidas (`transloco-keys-manager find`), en los dos
 *      sentidos. Una clave armada por concatenación aparece como sobrante.
 *   2. Todo diccionario tiene exactamente las claves del diccionario por defecto de su grupo:
 *      el raíz y cada scope (`<scope>/<lang>.json`) se comparan por separado.
 *   3. Formato canónico como un lockfile (claves ordenadas, 2 espacios, LF, salto final;
 *      lo arregla `npm run i18n:format`), segmentos en camelCase, hojas no vacías e ICU
 *      válido según el intérprete de @ewms/core, que se importa para no discrepar.
 *   4. Sin texto humano quemado en plantillas (.html e inline `template:`): texto visible
 *      fuera de una interpolación y literales de atributos que se leen o se oyen. Se
 *      saltean <code>, <pre>, atributos técnicos y texto sin letras. La lista EXEMPT no
 *      crece para callar ruido: el ruido se reporta.
 *
 * `npm run lint:i18n`.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  LiteralPrimitive,
  parseTemplate,
  TmplAstBoundText,
  TmplAstRecursiveVisitor,
  tmplAstVisitAll,
} from '@angular/compiler';
import { parseIcu } from '../../projects/core/src/lib/i18n/icu.ts';
import { DEFAULT_LANGUAGE, LANGUAGES } from '../../projects/core/src/lib/i18n/language.types.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIR = 'projects';
export const TRANSLATIONS_DIR = 'projects/shell/public/i18n';

/**
 * Rutas que la regla 12 no mira, y en qué control: `keys` (claves usadas contra definidas) o
 * `templates` (texto quemado). Cada entrada lleva su razón escrita al lado.
 */
const EXEMPT = [
  {
    prefix: 'projects/testing/',
    controls: ['keys', 'templates'],
    reason: 'Dev-only test support. Never rendered to a user and never shipped.',
  },
];

/** Atributos cuyo valor lee una persona o dice un lector de pantalla. */
const HUMAN_ATTRIBUTES = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'label',
  'placeholder',
  'title',
]);

/** Elementos cuyo contenido es código, no prosa. */
const CODE_ELEMENTS = new Set(['code', 'pre']);

const LETTER = /\p{L}/u;
const KEY_SEGMENT = /^[a-z][a-zA-Z0-9]*$/;

// ------------------------------------------------------------------ utilidades

function isExempt(file, control) {
  return EXEMPT.some(
    ({ prefix, controls }) => controls.includes(control) && file.startsWith(prefix),
  );
}

async function listFiles(dir, extensions) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...(await listFiles(relative, extensions)));
      }
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(relative);
    }
  }
  return files;
}

function isTestFile(file) {
  return file.endsWith('.spec.ts') || file.endsWith('.testing.ts');
}

function report(problems, file, line, message) {
  problems.push({ file, line, message });
}

function print({ file, line, message }) {
  console.error(
    process.env.GITHUB_ACTIONS
      ? `::error file=${file}${line ? `,line=${line}` : ''}::${message}`
      : `${file}${line ? `:${line}` : ''} ${message}`,
  );
}

/** Aplana un diccionario en claves `a.b.c` con el valor de cada hoja. */
export function flattenKeys(node, prefix = '') {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return [[prefix, node]];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    flattenKeys(value, prefix ? `${prefix}.${key}` : key),
  );
}

/** Texto canónico de un diccionario: claves ordenadas en profundidad, 2 espacios, LF. */
export function canonicalJson(dictionary) {
  const sort = (node) =>
    node !== null && typeof node === 'object' && !Array.isArray(node)
      ? Object.fromEntries(
          Object.keys(node)
            .sort()
            .map((key) => [key, sort(node[key])]),
        )
      : node;
  return `${JSON.stringify(sort(dictionary), null, 2)}\n`;
}

// ------------------------------------------------ control 2: mismas claves

/** Claves que faltan y que sobran en `other` respecto de `reference`. */
export function compareKeySets(reference, other) {
  const referenceKeys = new Set(flattenKeys(reference).map(([key]) => key));
  const otherKeys = new Set(flattenKeys(other).map(([key]) => key));
  return {
    missing: [...referenceKeys].filter((key) => !otherKeys.has(key)).sort(),
    extra: [...otherKeys].filter((key) => !referenceKeys.has(key)).sort(),
  };
}

/**
 * Agrupa los diccionarios por scope: `es.json` es del raíz (scope null), `showroom/es.json` del
 * scope `showroom`. Cada grupo necesita un archivo por idioma de LANGUAGES, y nada más.
 */
export function dictionaryGroups(paths, languages = LANGUAGES) {
  const groups = new Map([[null, new Map()]]);
  const problems = [];
  for (const relative of paths) {
    const parts = relative.split('/');
    const lang = parts.pop().replace(/\.json$/, '');
    const scope = parts.length ? parts.join('/') : null;
    if (!languages.includes(lang)) {
      problems.push(`${relative}: '${lang}' is not a language in LANGUAGES.`);
      continue;
    }
    if (!groups.has(scope)) {
      groups.set(scope, new Map());
    }
    groups.get(scope).set(lang, relative);
  }
  for (const [scope, files] of groups) {
    for (const lang of languages.filter((candidate) => !files.has(candidate))) {
      problems.push(
        `${scope === null ? '' : `${scope}/`}${lang}.json is missing. Every language in LANGUAGES ` +
          'needs its dictionary, in the root and in every scope.',
      );
    }
  }
  return { groups, problems };
}

// -------------------------------------------- control 3: formato y estructura

export function checkStructure(dictionary) {
  const problems = [];
  for (const [key, value] of flattenKeys(dictionary)) {
    const bad = key.split('.').filter((segment) => !KEY_SEGMENT.test(segment));
    if (bad.length) {
      problems.push(`'${key}': segment(s) ${bad.map((s) => `'${s}'`).join(', ')} not camelCase`);
    }
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`'${key}': the value must be a non-empty string`);
      continue;
    }
    try {
      parseIcu(value);
    } catch (error) {
      problems.push(`'${key}': invalid ICU: ${error.message}`);
    }
  }
  return problems;
}

// ------------------------------------ control 4: texto quemado en plantillas

class HardcodedTextVisitor extends TmplAstRecursiveVisitor {
  constructor() {
    super();
    this.found = [];
  }

  add(node, message) {
    this.found.push({ line: node.sourceSpan.start.line + 1, message });
  }

  visitElement(element) {
    if (CODE_ELEMENTS.has(element.name)) {
      return;
    }
    this.checkAttributes(element);
    super.visitElement(element);
  }

  visitTemplate(template) {
    this.checkAttributes(template);
    super.visitTemplate(template);
  }

  checkAttributes(node) {
    for (const attribute of node.attributes ?? []) {
      if (HUMAN_ATTRIBUTES.has(attribute.name) && LETTER.test(attribute.value)) {
        this.add(attribute, `hardcoded text in ${attribute.name}="${attribute.value.trim()}"`);
      }
    }
    for (const input of node.inputs ?? []) {
      const ast = input.value?.ast;
      if (
        HUMAN_ATTRIBUTES.has(input.name) &&
        ast instanceof LiteralPrimitive &&
        typeof ast.value === 'string' &&
        LETTER.test(ast.value)
      ) {
        this.add(input, `hardcoded text in [${input.name}]="'${ast.value.trim()}'"`);
      }
    }
  }

  visitText(text) {
    if (LETTER.test(text.value)) {
      this.add(text, `hardcoded text "${text.value.trim()}"`);
    }
  }

  visitBoundText(text) {
    const strings = text.value?.ast?.strings ?? [];
    const literal = strings.filter((part) => LETTER.test(part)).map((part) => part.trim());
    if (literal.length) {
      this.add(text, `hardcoded text around an interpolation: "${literal.join(' … ')}"`);
    }
  }
}

/** Devuelve `{ line, message }` por cada texto humano quemado. */
export function findHardcodedText(template, url = 'template.html') {
  const parsed = parseTemplate(template, url, { preserveWhitespaces: false });
  const problems = (parsed.errors ?? []).map((error) => ({
    line: (error.span?.start.line ?? 0) + 1,
    message: `template does not parse: ${error.msg}`,
  }));
  const visitor = new HardcodedTextVisitor();
  tmplAstVisitAll(visitor, parsed.nodes);
  return [...problems, ...visitor.found];
}

/** Los `template:` inline de un archivo TypeScript, con su línea inicial. */
export function inlineTemplates(source) {
  const found = [];
  const pattern = /\btemplate\s*:\s*(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g;
  for (const match of source.matchAll(pattern)) {
    const literal = match[1];
    const offset = match.index + match[0].indexOf(literal) + 1;
    found.push({
      template: literal.slice(1, -1),
      line: source.slice(0, offset).split('\n').length,
    });
  }
  return found;
}

/** La página host de cada aplicación (index.html) es un documento, no una plantilla. */
async function hostPages() {
  const workspace = JSON.parse(
    (await readFile(path.join(ROOT, 'angular.json'), 'utf8')).replace(/^\s*\/\/.*$/gm, ''),
  );
  return Object.values(workspace.projects)
    .filter((project) => project.projectType === 'application')
    .map((project) => {
      const index = project.architect?.build?.options?.index;
      const file = typeof index === 'string' ? index : (index?.input ?? 'index.html');
      return path.posix.join(project.sourceRoot ?? `${project.root}/src`, path.posix.basename(file));
    });
}

// ------------------------------------------------------------------ compuerta

/** Los diccionarios leídos, por grupo: `[{ scope, dictionaries: Map<lang, { file, raw, data }> }]`. */
async function readDictionaries() {
  const problems = [];
  const paths = (await listFiles(TRANSLATIONS_DIR, new Set(['.json']))).map((file) =>
    file.slice(TRANSLATIONS_DIR.length + 1),
  );
  const { groups, problems: layout } = dictionaryGroups(paths);
  layout.forEach((message) => report(problems, TRANSLATIONS_DIR, 0, message));
  const result = [];
  for (const [scope, files] of groups) {
    const dictionaries = new Map();
    for (const [lang, relative] of files) {
      const file = `${TRANSLATIONS_DIR}/${relative}`;
      const raw = await readFile(path.join(ROOT, file), 'utf8');
      try {
        dictionaries.set(lang, { file, raw, data: JSON.parse(raw.replace(/^\uFEFF/, '')) });
      } catch (error) {
        report(problems, file, 0, `is not valid JSON: ${error.message}`);
      }
    }
    result.push({ scope, dictionaries });
  }
  return { groups: result, problems };
}

/**
 * Control 1. keys-manager recorre carpetas y no sabe saltear specs, cuyas claves son
 * fixtures: se copian las fuentes a un temporal sin specs, soporte de pruebas ni rutas
 * exentas, y `find` corre sobre esa copia contra los diccionarios reales.
 */
async function checkUsedKeys() {
  const problems = [];
  const sources = (await listFiles(SCAN_DIR, new Set(['.ts', '.html']))).filter(
    (file) => !isTestFile(file) && !isExempt(file, 'keys'),
  );
  const mirror = await mkdtemp(path.join(tmpdir(), 'ewms-i18n-'));
  try {
    for (const file of sources) {
      await cp(path.join(ROOT, file), path.join(mirror, file));
    }
    // keys-manager sale con 0 ante una ruta errónea: eso nunca cuenta como verde.
    for (const dir of [mirror, path.join(ROOT, TRANSLATIONS_DIR)]) {
      if (!(await stat(dir)).isDirectory()) {
        throw new Error(`${dir} is not a directory`);
      }
    }
    const cli = path.join(ROOT, 'node_modules/@jsverse/transloco-keys-manager/index.js');
    const result = spawnSync(
      process.execPath,
      [
        cli,
        'find',
        '--input',
        path.join(mirror, SCAN_DIR),
        '--translations-path',
        path.join(ROOT, TRANSLATIONS_DIR),
        '--emit-error-on-extra-keys',
      ],
      { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } },
    );
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.status === 0 && /No missing keys/i.test(output)) {
      console.log(`i18n: keys used and defined match (${sources.length} source files).`);
    } else {
      console.error(output.trim());
      const reason =
        result.status === 1
          ? 'keys used in code are missing from the dictionaries (column "Missing Keys").'
          : result.status === 2
            ? 'keys in the dictionaries are used nowhere (column "Extra Keys"). Delete them, ' +
              'or if the key is built from data, write the literal keys in a Record with a ' +
              '/** t(key.a, key.b) */ marker (i18n.md).'
            : `transloco-keys-manager did not report a clean result (exit ${result.status}).`;
      report(problems, TRANSLATIONS_DIR, 0, reason);
    }
  } finally {
    await rm(mirror, { recursive: true, force: true });
  }
  return problems;
}

/** Control 2 sobre todos los grupos: cada uno contra el diccionario por defecto de su grupo. */
export function checkSameKeys(groups) {
  return groups.flatMap(({ scope, dictionaries }) => checkGroupKeys(scope, dictionaries));
}

function checkGroupKeys(scope, dictionaries) {
  const problems = [];
  const reference = dictionaries.get(DEFAULT_LANGUAGE);
  if (!reference) {
    return problems;
  }
  for (const [lang, dictionary] of dictionaries) {
    if (lang === DEFAULT_LANGUAGE) {
      continue;
    }
    const { missing, extra } = compareKeySets(reference.data, dictionary.data);
    if (missing.length) {
      report(
        problems,
        dictionary.file,
        0,
        `lacks ${missing.length} key(s) that ${reference.file} has: ${missing.join(', ')}`,
      );
    }
    if (extra.length) {
      report(
        problems,
        dictionary.file,
        0,
        `has ${extra.length} key(s) that ${reference.file} lacks: ${extra.join(', ')}`,
      );
    }
  }
  if (!problems.length) {
    const count = flattenKeys(reference.data).length;
    const where = scope === null ? 'root' : `scope ${scope}`;
    console.log(
      `i18n: ${where}: ${[...dictionaries.keys()].join(', ')} share the same ${count} keys.`,
    );
  }
  return problems;
}

async function checkFormat(groups, write) {
  const problems = [];
  const all = groups.flatMap(({ dictionaries }) => [...dictionaries.values()]);
  for (const { file, raw, data } of all) {
    for (const problem of checkStructure(data)) {
      report(problems, file, 0, problem);
    }
    const canonical = canonicalJson(data);
    if (raw !== canonical) {
      if (write) {
        await writeFile(path.join(ROOT, file), canonical, 'utf8');
        console.log(`i18n: formatted ${file}.`);
      } else {
        const hint = raw.includes('\r\n') ? ' It has CRLF line endings; .gitattributes pins LF.' : '';
        report(
          problems,
          file,
          0,
          `is not in canonical format (keys sorted, 2-space indent, LF, final newline). ` +
            `Run \`npm run i18n:format\`.${hint}`,
        );
      }
    }
  }
  if (!problems.length) {
    console.log(`i18n: dictionaries are canonical and well-formed.`);
  }
  return problems;
}

async function checkTemplates() {
  const problems = [];
  const hosts = new Set(await hostPages());
  const files = (await listFiles(SCAN_DIR, new Set(['.html', '.ts']))).filter(
    (file) => !isExempt(file, 'templates') && !isTestFile(file) && !hosts.has(file),
  );
  let templates = 0;
  for (const file of files) {
    const content = await readFile(path.join(ROOT, file), 'utf8');
    const found = file.endsWith('.html')
      ? [{ template: content, line: 1 }]
      : inlineTemplates(content);
    for (const { template, line } of found) {
      templates += 1;
      for (const problem of findHardcodedText(template, file)) {
        report(
          problems,
          file,
          line + problem.line - 1,
          `${problem.message}. Move it to the dictionaries and render it with the transloco pipe.`,
        );
      }
    }
  }
  if (!problems.length) {
    console.log(
      `i18n: no hardcoded text in ${templates} template(s) ` +
        `(exempt: ${EXEMPT.filter(({ controls }) => controls.includes('templates'))
          .map(({ prefix }) => prefix)
          .join(', ')}; host pages: ${[...hosts].join(', ')}).`,
    );
  }
  return problems;
}

async function main() {
  const write = process.argv.includes('--write');
  const { groups, problems } = await readDictionaries();
  if (write) {
    problems.push(...(await checkFormat(groups, true)));
  } else {
    problems.push(
      ...(await checkUsedKeys()),
      ...checkSameKeys(groups),
      ...(await checkFormat(groups, false)),
      ...(await checkTemplates()),
    );
  }
  if (problems.length) {
    problems.forEach(print);
    console.error(`\ni18n: ${problems.length} problem(s). See ADR 0008 and i18n.md.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
