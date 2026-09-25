/**
 * Regla 15: solo el sistema de diseño. Fuera de `projects/design-system/src/lib/` ninguna
 * plantilla (.html o `template:` inline) escribe un control nativo: <button>, <input>, <select>,
 * <textarea> o <table>. Si el sistema no tiene la pieza, se agrega al sistema; nunca se arma
 * con clases sueltas en una pantalla. `<a>` para navegar sigue siendo `<a>`.
 *
 * `npm run lint:ds`. Ver vault: 08-Sistema-de-Diseno/Nomenclatura de Componentes y Tokens.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseTemplate, TmplAstRecursiveVisitor, tmplAstVisitAll } from '@angular/compiler';
import { inlineTemplates } from './check-i18n.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIR = 'projects';
const LIBRARY = 'projects/design-system/src/lib/';

/** Lo que el sistema de diseño ya resuelve: escrito a mano en una pantalla, es una copia. */
export const NATIVE_CONTROLS = new Set(['button', 'input', 'select', 'textarea', 'table']);

/**
 * Rutas que la regla 15 no mira, cada una con su razón. `elements` acota la exención: fuera de
 * esos elementos la ruta se revisa igual. La lista no crece para callar ruido.
 */
export const EXEMPT = [
  {
    prefix: 'projects/shell/src/index.html',
    elements: null,
    reason:
      'Startup notice shown when no dictionary loads: it lives outside Angular (the CSP blocks ' +
      'the alternatives), so there is no design system to render it with. See i18n.md, case B.',
  },
  {
    prefix: 'projects/showroom/src/lib/ui/',
    elements: new Set(['table']),
    reason:
      'The catalogue documentation tables (props, state matrix) are the showroom chrome, not ' +
      'product UI: every page renders them through these widgets and never writes its own.',
  },
];

function exemptionFor(file, element) {
  return EXEMPT.find(
    ({ prefix, elements }) =>
      file.startsWith(prefix) && (elements === null || elements.has(element)),
  );
}

class NativeControlVisitor extends TmplAstRecursiveVisitor {
  constructor() {
    super();
    this.found = [];
  }

  visitElement(element) {
    if (NATIVE_CONTROLS.has(element.name)) {
      this.found.push({ line: element.sourceSpan.start.line + 1, element: element.name });
    }
    super.visitElement(element);
  }
}

/** `{ line, element }` por cada control nativo de la plantilla, más los errores de parseo. */
export function findNativeControls(template, url = 'template.html') {
  const parsed = parseTemplate(template, url, { preserveWhitespaces: false });
  const visitor = new NativeControlVisitor();
  tmplAstVisitAll(visitor, parsed.nodes);
  const errors = (parsed.errors ?? []).map((error) => ({
    line: (error.span?.start.line ?? 0) + 1,
    element: null,
    message: `template does not parse: ${error.msg}`,
  }));
  return [...errors, ...visitor.found];
}

/** Hallazgos de un archivo ya leído, sin las exenciones que le tocan. */
export function checkFile(file, content) {
  if (file.startsWith(LIBRARY)) {
    return [];
  }
  const templates = file.endsWith('.html')
    ? [{ template: content, line: 1 }]
    : inlineTemplates(content);
  return templates.flatMap(({ template, line }) =>
    findNativeControls(template, file)
      .filter(({ element }) => element === null || exemptionFor(file, element) === undefined)
      .map((finding) => ({
        file,
        line: line + finding.line - 1,
        message:
          finding.message ??
          `native <${finding.element}> outside the design system. Use its ewms-* component; ` +
            'if the design system lacks the piece, add it there first.',
      })),
  );
}

async function listFiles(dir) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...(await listFiles(relative)));
      }
    } else if (/\.(html|ts)$/.test(entry.name) && !/\.(spec|testing)\.ts$/.test(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

async function main() {
  const files = await listFiles(SCAN_DIR);
  const problems = [];
  for (const file of files) {
    problems.push(...checkFile(file, await readFile(path.join(ROOT, file), 'utf8')));
  }
  for (const { file, line, message } of problems) {
    console.error(
      process.env.GITHUB_ACTIONS
        ? `::error file=${file},line=${line}::${message}`
        : `${file}:${line} ${message}`,
    );
  }
  if (problems.length) {
    console.error(
      `\ndesign system only: ${problems.length} native control(s) outside the library.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `design system only: no native controls in ${files.length} file(s) outside ${LIBRARY} ` +
        `(exempt: ${EXEMPT.map(({ prefix, elements }) => (elements ? `${prefix} [${[...elements].join(', ')}]` : prefix)).join('; ')}).`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
