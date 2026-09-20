/**
 * The two claims REQ-FE-DS4-001 makes about the SOURCE, checked rather than
 * promised.
 *
 *   1. RFE-01 / PACQ-01.3 -- the map is the only place a key is named. Every
 *      binding in a `shortcuts.map.ts` is looked for everywhere else. A screen
 *      that wrote `case 'Escape':` to mean "cancel" would be a second place a
 *      key lives, and the day somebody rebinds cancel the screen keeps its old
 *      one, silently.
 *
 *   2. RFE-03 / HG-04 -- one global keyboard listener. A `document` keydown
 *      anywhere outside `keyboard/` is a second engine, and two engines mean
 *      every shortcut fires twice.
 *
 * WHY A SOURCE SCAN AND NOT A RUNTIME TEST. Both of these are about code that
 * is NOT running: the second listener nobody mounted yet, the key somebody
 * wrote into a screen they have not finished. A runtime test can only see what
 * a test happens to render. `KeyboardShortcuts.mount` also throws on a second
 * host at runtime, which covers the case this cannot: a host mounted from a
 * template that this scan reads as ordinary markup.
 *
 * Run with `npm run lint:shortcuts`, and asserted by check-shortcuts.test.mjs.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIR = 'projects';
const EXTENSIONS = new Set(['.html', '.ts']);

/**
 * The files allowed to name a key, and the only ones.
 *
 * One per application, which is what RFE-01 means by "a single file": the
 * shell and the showroom are two applications that each provide their own
 * `EWMS_SHORTCUT_MAP`, because the showroom may not import the shell.
 */
export const MAP_FILES = [
  'projects/shell/src/app/shortcuts.map.ts',
  'projects/showroom/src/lib/shortcuts.map.ts',
];

/**
 * Where a key may legitimately be spelled for a reason that is NOT the global
 * map, each with the reason.
 *
 * THIS LIST IS THE INTERESTING PART OF THE GATE, because every entry is a
 * judgement somebody has to defend. A component closing its OWN overlay on
 * Escape is not the global cancel shortcut -- it is the component's behaviour,
 * it is specified in that component's sheet, and it runs before the engine
 * sees the event (the engine skips anything already answered). Confusing the
 * two would mean turning off the global cancel binding silently stopped every
 * dropdown from closing.
 */
export const KEY_EXEMPT = [
  // The engine and its own tests. It compares `event.key` against the map and
  // never names one -- except in the spec, where the map is written out on
  // purpose so that changing a binding breaks a test.
  'projects/design-system/src/lib/keyboard/',
  // Components closing their own overlay, moving their own list, or answering
  // their own Enter. Behaviour of the component, not the global map.
  'projects/design-system/src/lib/dialog/',
  'projects/design-system/src/lib/select/',
  'projects/design-system/src/lib/search-select/',
  'projects/design-system/src/lib/listbox/',
  'projects/design-system/src/lib/table/',
  'projects/design-system/src/lib/tooltip/',
  'projects/design-system/src/lib/toast/',
  'projects/design-system/src/lib/card/',
  'projects/design-system/src/lib/button/',
  'projects/design-system/src/lib/icon-button/',
  'projects/design-system/src/lib/overlay/',
  // DS-5: the bottom navigation's sheet closes on Escape and the rail walks
  // itself with the arrows. Same category as the dialog and the select --
  // a component answering its OWN keys, specified in its own sheet, and
  // running before the engine sees the event. Turning the global `cancel`
  // binding off must not stop a panel from closing.
  'projects/design-system/src/lib/navigation/',
  // The catalogue TALKS about keys -- it is documentation, and a sheet that
  // could not print the key it documents would be useless.
  'projects/showroom/src/lib/pages/',
];

/**
 * Where a global keydown listener may live.
 *
 * `search-select/` is on the list and the reason is written in the component:
 * a field measures the gaps of what is typed INTO IT, which is not a global
 * listener at all -- it is a handler on its own input.
 */
export const LISTENER_EXEMPT = [
  'projects/design-system/src/lib/keyboard/',
  'projects/design-system/src/lib/search-select/',
  'projects/design-system/src/lib/dialog/',
  'projects/design-system/src/lib/toast/',
  'projects/design-system/src/lib/tooltip/',
];

/**
 * `document.addEventListener('keydown'`, plus both of Angular's global-target
 * forms: `@HostListener('document:keydown')` and the host binding
 * `'(document:keydown)'`. The optional `(` is what tells the two apart, and
 * leaving it out let the host-binding form through -- which the test below
 * caught, and which is the form somebody is most likely to reach for.
 */
const GLOBAL_LISTENER =
  /(?:document|window|globalThis)\s*\.\s*addEventListener\s*\(\s*['"`]key(?:down|press|up)['"`]|['"`]\(?(?:document|window):key(?:down|press|up)/g;

/**
 * Pull every `key:` value out of a map file.
 *
 * Deliberately a regular expression over the source rather than an import: the
 * point is to read what is WRITTEN, and importing the module would make the
 * gate agree with itself about a map assembled at runtime.
 */
export function bindingKeys(source) {
  return [...source.matchAll(/\bkey:\s*'([^']+)'/g)].map((match) => match[1]);
}

/**
 * Every place `key` is spelled as a string literal in this source.
 *
 * A SINGLE CHARACTER IS ONLY LOOKED FOR WHERE IT IS BEING TREATED AS A KEY --
 * compared against something called `key`, or in a `case` of a switch. A bare
 * `'s'` is also a CSS unit, a path fragment and half the strings in a
 * template; the first version of this gate matched `=== 's'` in
 * `read-token.ts`, where it means *seconds*, and that false positive is what
 * narrowed the rule. What the gate is actually protecting against is a screen
 * writing `event.key === 'n' && event.altKey` instead of registering `create`,
 * and that always mentions `key`.
 *
 * A named key like `Escape` stays distinctive enough to look for anywhere.
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

/** Every global keyboard listener in this source. */
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
