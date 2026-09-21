/**
 * Genera icons.generated.ts desde icons.manifest.json, la lista permitida y única fuente
 * de verdad: nombre semántico -> archivo. `custom/<nombre>` lee custom/<nombre>.svg; lo
 * demás es Tabler outline. Los dos pasan por la misma extracción (ADR 0011).
 *
 *   - Tabler: el primer hijo debe ser la caja invisible `M0 0h24v24H0z`, que se descarta;
 *     si falta, cambió el formato del paquete y falla. En los propios es opcional.
 *   - Una caja en cualquier posición que no sea la primera falla.
 *   - Solo <path> y solo `d`: otro elemento falla con la solución (convertirlo a path), y
 *     otro atributo falla en vez de descartarse, porque tirar un `fill` cambia el icono.
 *   - Salida determinista (iconos por nombre, primitivas en orden de archivo): check-icons
 *     la regenera en memoria y compara byte a byte. Un SVG propio sin entrada falla.
 *
 * El archivo generado se versiona; no se produce en el build. `npm run icons:build`.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ICONS_DIR = 'projects/design-system/src/icons';
const MANIFEST = `${ICONS_DIR}/icons.manifest.json`;
const CUSTOM_DIR = `${ICONS_DIR}/custom`;
const TABLER_PACKAGE = 'node_modules/@tabler/icons';
const TABLER_OUTLINE_DIR = `${TABLER_PACKAGE}/icons/outline`;
export const OUTPUT = `${ICONS_DIR}/icons.generated.ts`;

const CUSTOM_PREFIX = 'custom/';
const BOUNDING_BOX = 'M0 0h24v24H0z';
const CATEGORIES = ['domain', 'interface'];
const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** El único elemento que puede tener un icono, y su único atributo (ADR 0011). */
const SHAPE = 'path';
const GEOMETRY_ATTRIBUTE = 'd';

// ----------------------------------------------------------------- manifiesto

async function readManifest() {
  const manifest = JSON.parse(await readFile(path.join(ROOT, MANIFEST), 'utf8'));
  const keys = Object.keys(manifest);
  if (keys.join() !== CATEGORIES.join()) {
    throw new Error(
      `${MANIFEST}: top-level keys must be exactly ${JSON.stringify(CATEGORIES)}, got ${JSON.stringify(keys)}.`,
    );
  }

  const entries = [];
  const seen = new Map();
  for (const category of CATEGORIES) {
    for (const [name, source] of Object.entries(manifest[category])) {
      if (!NAME_PATTERN.test(name)) {
        throw new Error(`${MANIFEST}: "${name}" is not a kebab-case semantic name.`);
      }
      if (seen.has(name)) {
        throw new Error(`${MANIFEST}: "${name}" appears in both "${seen.get(name)}" and "${category}".`);
      }
      if (typeof source !== 'string' || source.length === 0) {
        throw new Error(`${MANIFEST}: "${name}" must map to a file name.`);
      }
      seen.set(name, category);
      entries.push({ name, category, source });
    }
  }
  return entries;
}

function sourceFile(source) {
  const file = source.startsWith(CUSTOM_PREFIX)
    ? `${CUSTOM_DIR}/${source.slice(CUSTOM_PREFIX.length)}.svg`
    : `${TABLER_OUTLINE_DIR}/${source}.svg`;
  return file;
}

// ---------------------------------------------------------------------- svg

function parseAttributes(text, where) {
  const attributes = new Map();
  const rest = text.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, (_, name, value) => {
    if (attributes.has(name)) {
      throw new Error(`${where}: duplicate attribute "${name}".`);
    }
    attributes.set(name, value);
    return '';
  });
  if (rest.trim() !== '') {
    throw new Error(`${where}: unparseable attribute text ${JSON.stringify(rest.trim())}.`);
  }
  return attributes;
}

/**
 * Extrae la geometría de un SVG como lista de primitivas. `requireBoundingBox` es true
 * para Tabler (si falta la caja cambió el formato del paquete) y false para los propios.
 */
export function extractPrimitives(svg, where, { requireBoundingBox }) {
  const root = /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svg);
  if (!root) {
    throw new Error(`${where}: expected a single <svg> root element.`);
  }
  if (parseAttributes(root[1], where).get('viewBox') !== '0 0 24 24') {
    throw new Error(`${where}: viewBox must be "0 0 24 24" (ADR 0011: 24x24 grid).`);
  }

  const body = root[2];
  const elements = [];
  const leftover = body.replace(/<([a-zA-Z]+)\b([^>]*?)\/>/g, (_, tag, attributes) => {
    elements.push({ tag, attributes: parseAttributes(attributes, `${where} <${tag}>`) });
    return '';
  });
  if (leftover.trim() !== '') {
    throw new Error(
      `${where}: unsupported content inside <svg> (only self-closing shapes are allowed): ` +
        JSON.stringify(leftover.trim().slice(0, 80)),
    );
  }

  const [first] = elements;
  const startsWithBoundingBox = first?.tag === 'path' && first.attributes.get('d') === BOUNDING_BOX;
  if (requireBoundingBox && !startsWithBoundingBox) {
    throw new Error(`${where}: first element must be the bounding-box path "${BOUNDING_BOX}".`);
  }
  const shapes = startsWithBoundingBox ? elements.slice(1) : elements;
  if (shapes.length === 0) {
    throw new Error(`${where}: no geometry in the file.`);
  }

  return shapes.map(({ tag, attributes }) => {
    const element = `${where} <${tag}>`;
    if (tag !== SHAPE) {
      throw new Error(
        `${element}: unsupported element. Icons are <path> only (ADR 0011): convert the shape to a ` +
          'path before adding the icon, as any vector editor does on export.',
      );
    }
    if (attributes.get(GEOMETRY_ATTRIBUTE) === BOUNDING_BOX) {
      throw new Error(`${element}: bounding-box path found outside first position.`);
    }

    const extra = [...attributes.keys()].filter((name) => name !== GEOMETRY_ATTRIBUTE);
    if (extra.length > 0) {
      throw new Error(
        `${element}: non-geometry attribute(s) ${extra.join(', ')}. The component sets presentation ` +
          'once on the <svg>; an icon that needs its own fill or stroke does not belong in this set.',
      );
    }

    const d = attributes.get(GEOMETRY_ATTRIBUTE);
    if (d === undefined) {
      throw new Error(`${element}: missing "${GEOMETRY_ATTRIBUTE}".`);
    }
    return { type: SHAPE, d: d.replace(/\s+/g, ' ').trim() };
  });
}

// ------------------------------------------------------------------- salida

function quote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function key(name) {
  return /^[a-z][a-z0-9]*$/.test(name) ? name : quote(name);
}

function serialisePrimitive({ type, d }) {
  return `{ type: ${quote(type)}, d: ${quote(d)} }`;
}

/** Devuelve el texto completo de icons.generated.ts y la cantidad de iconos. Solo lee. */
export async function buildIcons() {
  const entries = await readManifest();
  const tabler = JSON.parse(await readFile(path.join(ROOT, TABLER_PACKAGE, 'package.json'), 'utf8'));

  const referencedCustom = new Set(
    entries.filter((e) => e.source.startsWith(CUSTOM_PREFIX)).map((e) => sourceFile(e.source)),
  );
  const customFiles = (await readdir(path.join(ROOT, CUSTOM_DIR)))
    .filter((file) => file.endsWith('.svg'))
    .map((file) => `${CUSTOM_DIR}/${file}`);
  const orphans = customFiles.filter((file) => !referencedCustom.has(file));
  if (orphans.length > 0) {
    throw new Error(
      `Custom icon(s) not referenced by ${MANIFEST}: ${orphans.join(', ')}. Add them to the manifest or delete them.`,
    );
  }

  const icons = [];
  for (const entry of entries) {
    const file = sourceFile(entry.source);
    let svg;
    try {
      svg = await readFile(path.join(ROOT, file), 'utf8');
    } catch {
      throw new Error(
        `"${entry.name}" -> "${entry.source}": ${file} does not exist` +
          (entry.source.startsWith(CUSTOM_PREFIX) ? '.' : ` in @tabler/icons ${tabler.version}.`),
      );
    }
    const requireBoundingBox = !entry.source.startsWith(CUSTOM_PREFIX);
    icons.push({ ...entry, primitives: extractPrimitives(svg, file, { requireBoundingBox }) });
  }

  const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  icons.sort(byName);

  const lines = [
    '// GENERADO POR tools/icons/build-icons.mjs — NO EDITAR A MANO.',
    '//',
    `// Fuente: ${MANIFEST}`,
    `// Geometria: @tabler/icons ${tabler.version} (MIT, ver THIRD-PARTY-NOTICES.md) y ${CUSTOM_DIR}/.`,
    '// Para cambiar un icono: editar el manifiesto y correr `npm run icons:build`. Ver ADR 0011.',
    '',
    "import type { IconPrimitive } from './icon-primitive';",
    '',
    'const DATA = {',
  ];
  for (const icon of icons) {
    lines.push(`  ${key(icon.name)}: [`);
    for (const primitive of icon.primitives) {
      lines.push(`    ${serialisePrimitive(primitive)},`);
    }
    lines.push('  ],');
  }
  lines.push(
    '} as const satisfies Record<string, readonly IconPrimitive[]>;',
    '',
    '/** Todos los iconos que existen. Un nombre fuera de esta union es error de compilacion. */',
    'export type IconName = keyof typeof DATA;',
    '',
    'export const ICONS: Readonly<Record<IconName, readonly IconPrimitive[]>> = DATA;',
    '',
    `export type IconCategory = ${CATEGORIES.map(quote).join(' | ')};`,
    '',
    '/** Agrupacion del manifiesto, nombres ordenados. La usa el catalogo del showroom. */',
    'export const ICON_CATEGORIES: Readonly<Record<IconCategory, readonly IconName[]>> = {',
  );
  for (const category of CATEGORIES) {
    lines.push(`  ${key(category)}: [`);
    for (const icon of icons.filter((i) => i.category === category)) {
      lines.push(`    ${quote(icon.name)},`);
    }
    lines.push('  ],');
  }
  lines.push('};', '');

  return { source: lines.join('\n'), count: icons.length };
}

async function main() {
  const { source, count } = await buildIcons();
  await writeFile(path.join(ROOT, OUTPUT), source, 'utf8');
  console.log(`Icons: wrote ${OUTPUT} (${count} icons, ${Buffer.byteLength(source)} bytes).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
