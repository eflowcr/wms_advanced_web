/**
 * Las dos afirmaciones de REQ-FE-DS4-001 sobre la fuente, comprobadas:
 *
 *   1. RFE-01 / PACQ-01.3: solo el mapa nombra una tecla. Una pantalla con
 *      `case 'Escape':` para cancelar conservaría la tecla vieja el día que se reasigne.
 *   2. RFE-03 / HG-04: un único listener global de teclado. Uno fuera de `keyboard/` es
 *      un segundo motor, y con dos motores cada atajo dispara dos veces.
 *
 * Escaneo de fuente y no prueba en ejecución: ambas tratan de código que todavía no
 * corre. `KeyboardShortcuts.mount` además lanza ante un segundo host en ejecución.
 * `npm run lint:shortcuts`; lo afirma check-shortcuts.test.mjs.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIR = 'projects';
const EXTENSIONS = new Set(['.html', '.ts']);

/**
 * Los únicos archivos que pueden nombrar una tecla: uno por aplicación («un solo
 * archivo» de RFE-01), porque el showroom no puede importar el shell.
 */
export const MAP_FILES = [
  'projects/shell/src/app/shortcuts.map.ts',
  'projects/showroom/src/lib/shortcuts.map.ts',
];

/**
 * Dónde se puede escribir una tecla por una razón que no es el mapa global. Cada entrada
 * es un criterio que alguien defiende: un componente que cierra su propio overlay con
 * Escape no es el atajo global de cancelar, y corre antes de que el motor vea el evento.
 */
export const KEY_EXEMPT = [
  // El motor y sus pruebas: compara `event.key` contra el mapa sin nombrar teclas,
  // salvo la spec, que escribe el mapa a propósito para que un cambio rompa una prueba.
  'projects/design-system/src/lib/keyboard/',
  // Componentes que cierran su overlay, recorren su lista o atienden su Enter.
  'projects/design-system/src/lib/dialog/',
  'projects/design-system/src/lib/select/',
  'projects/design-system/src/lib/listbox/',
  'projects/design-system/src/lib/table/',
  'projects/design-system/src/lib/tooltip/',
  'projects/design-system/src/lib/toast/',
  'projects/design-system/src/lib/card/',
  'projects/design-system/src/lib/button/',
  'projects/design-system/src/lib/split-button/',
  'projects/design-system/src/lib/date-picker/',
  'projects/design-system/src/lib/overlay/',
  // DS-5: la hoja de la navegación inferior cierra con Escape y el rail se recorre con
  // flechas. Misma categoría que dialog y select: apagar `cancel` no debe dejar un panel
  // sin cerrar.
  'projects/design-system/src/lib/navigation/',
  // El catálogo habla de teclas: es documentación y tiene que poder imprimirlas.
  'projects/showroom/src/lib/pages/',
];

/**
 * Dónde puede vivir un listener global de keydown. `select/` mide los tiempos de
 * lo que se tipea en su propio input: no es un listener global (la razón está en el componente).
 */
export const LISTENER_EXEMPT = [
  'projects/design-system/src/lib/keyboard/',
  'projects/design-system/src/lib/select/',
  'projects/design-system/src/lib/dialog/',
  'projects/design-system/src/lib/toast/',
  'projects/design-system/src/lib/tooltip/',
];

/**
 * `document.addEventListener('keydown'` y las dos formas de Angular:
 * `@HostListener('document:keydown')` y el host binding `'(document:keydown)'`. El `(`
 * opcional las distingue; sin él pasaba el host binding, y la prueba lo atrapó.
 */
const GLOBAL_LISTENER =
  /(?:document|window|globalThis)\s*\.\s*addEventListener\s*\(\s*['"`]key(?:down|press|up)['"`]|['"`]\(?(?:document|window):key(?:down|press|up)/g;

/**
 * Saca cada valor `key:` de un archivo de mapa. Expresión regular sobre la fuente y no
 * import: importar el módulo haría que la compuerta coincidiera consigo misma.
 */
export function bindingKeys(source) {
  return [...source.matchAll(/\bkey:\s*'([^']+)'/g)].map((match) => match[1]);
}

/**
 * Cada lugar donde `key` aparece como literal. Un carácter suelto solo se busca donde se
 * trata como tecla (comparado con algo llamado `key`, o en un `case`): la primera versión
 * atrapó `=== 's'` en `read-token.ts`, donde significa segundos. `Escape` se busca en todas partes.
 */
export function keyMentions(source, key) {
  const quoted = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const literal = `['"\`]${quoted}['"\`]`;
  const pattern =
    key.length === 1
      ? new RegExp(`(?:\\bkey\\s*(?:===|!==|==|!=)\\s*${literal}|case\\s*${literal}\\s*:)`, 'g')
      : new RegExp(literal, 'g');
  return [...source.matchAll(pattern)].map((match) => ({
    index: match.index,
    text: match[0],
  }));
}

/** Cada listener global de teclado en esta fuente. */
export function globalListeners(source) {
  return [...source.matchAll(GLOBAL_LISTENER)].map((match) => ({
    index: match.index,
    text: match[0],
  }));
}

export function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
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
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relative);
    }
  }
  return files;
}

function error(file, line, message) {
  console.error(
    process.env.GITHUB_ACTIONS
      ? `::error file=${file},line=${line}::${message}`
      : `${file}:${line} ${message}`,
  );
}

async function main() {
  const keys = new Set();
  for (const mapFile of MAP_FILES) {
    const source = await readFile(path.join(ROOT, mapFile), 'utf8');
    for (const key of bindingKeys(source)) {
      keys.add(key);
    }
  }
  if (keys.size === 0) {
    console.error('Shortcuts: no bindings found in the map files. The gate would pass vacuously.');
    process.exitCode = 1;
    return;
  }

  const files = await listFiles(SCAN_DIR);
  let violations = 0;

  for (const file of files) {
    const source = await readFile(path.join(ROOT, file), 'utf8');

    if (!MAP_FILES.includes(file) && !KEY_EXEMPT.some((dir) => file.startsWith(dir))) {
      for (const key of keys) {
        for (const mention of keyMentions(source, key)) {
          error(
            file,
            lineOf(source, mention.index),
            `names the key ${mention.text} of a global shortcut. Only ${MAP_FILES.join(' and ')} ` +
              'may name a key (REQ-FE-DS4-001 RFE-01). Register the ACTION instead.',
          );
          violations += 1;
        }
      }
    }

    if (!LISTENER_EXEMPT.some((dir) => file.startsWith(dir))) {
      for (const listener of globalListeners(source)) {
        error(
          file,
          lineOf(source, listener.index),
          'installs a global keyboard listener. There is exactly one in the application, ' +
            'mounted by ewmsShortcutsHost on the root layout (REQ-FE-DS4-001 RFE-03).',
        );
        violations += 1;
      }
    }
  }

  if (violations > 0) {
    console.error('\nShortcuts: gate failed. See REQ-FE-DS4-001 RFE-01 and RFE-03.');
    process.exitCode = 1;
    return;
  }
  console.log(
    `Shortcuts: ${keys.size} key(s) named only in ${MAP_FILES.length} map file(s); ` +
      `one global listener, across ${files.length} files.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((reason) => {
    console.error(reason instanceof Error ? reason.message : reason);
    process.exitCode = 1;
  });
}
