/**
 * Builds projects/design-system/src/icons/icons.generated.ts from the manifest.
 *
 * The manifest (icons.manifest.json) is the allowlist and the only source of
 * truth for which icons exist: semantic product name -> source file. A value
 * of `custom/<name>` reads projects/design-system/src/icons/custom/<name>.svg;
 * anything else is a Tabler outline icon from node_modules/@tabler/icons.
 * Both go through exactly the same extraction, so the output does not reveal
 * where an icon came from. See ADR 0011.
 *
 * Rules, every one of them enforced here rather than trusted:
 *
 *   - Tabler files: the first child must be the invisible bounding box,
 *     <path stroke="none" d="M0 0h24v24H0z" fill="none"/>. It is dropped. A
 *     Tabler file without it is a change in the package format and fails.
 *   - Custom files: the bounding box is optional. If it is the first child it
 *     is dropped exactly as for Tabler; if not, every child is geometry. A
 *     custom icon should not need a Tabler artefact to be valid.
 *   - In either kind of file, a bounding box anywhere but first fails.
 *   - Only <path> is accepted, and only its `d`. The set is paths on purpose
 *     (ADR 0011): Tabler outline and the custom pallet are paths only, so a
 *     <circle>, <rect> or <line> would be a second format that no icon uses.
 *     Any other element fails with the fix (convert it to a path, as any
 *     editor does on export). Any other attribute fails instead of being
 *     silently dropped: dropping a `fill` would change how the icon looks.
 *   - Output is deterministic: icons sorted by name, primitives in file order,
 *     one serialisation. tools/ci/check-icons.mjs regenerates in memory and
 *     compares byte for byte, like a lockfile.
 *   - A custom SVG that the manifest does not reference fails: nothing in the
 *     icon directory exists outside the allowlist.
 *
 * The generated file is committed. It is not produced during the build.
 *
 *   npm run icons:build
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

/** The only element an icon may contain, and its only attribute (ADR 0011). */
const SHAPE = 'path';
const GEOMETRY_ATTRIBUTE = 'd';

// ----------------------------------------------------------------- manifest

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
 * Extracts the geometry of one SVG file as a list of primitives.
 *
 * `requireBoundingBox` is true for Tabler files (a missing bounding box means
 * the package format changed) and false for custom files (optional).
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

// ------------------------------------------------------------------- output

function quote(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function key(name) {
  return /^[a-z][a-z0-9]*$/.test(name) ? name : quote(name);
}

function serialisePrimitive({ type, d }) {
  return `{ type: ${quote(type)}, d: ${quote(d)} }`;
}

/** Returns the full text of icons.generated.ts and the icon count. Reads, never writes. */
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
    '/** Every icon that exists. A name outside this union is a compile error. */',
    'export type IconName = keyof typeof DATA;',
    '',
    'export const ICONS: Readonly<Record<IconName, readonly IconPrimitive[]>> = DATA;',
    '',
    `export type IconCategory = ${CATEGORIES.map(quote).join(' | ')};`,
    '',
    '/** Manifest grouping, names sorted. Used by the showroom catalogue. */',
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
