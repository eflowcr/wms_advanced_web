/**
 * Huella de cada diccionario: el loader lo pide como `i18n/<ruta>.json?v=<huella>`, así un
 * contenido nuevo es una URL nueva y ningún caché sirve el viejo. `npm run i18n:versions`;
 * la regla 12 falla si la tabla quedó vieja. Ver vault: ADR 0018 y 08-Sistema-de-Diseno/i18n.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DICTIONARIES = 'projects/shell/public/i18n';
export const OUTPUT = 'projects/shell/src/app/dictionary-versions.generated.ts';

/** Diez hex de sha256 del JSON sin CRLF: el mismo diccionario da la misma huella en todo sistema. */
export function fingerprint(content) {
  return createHash('sha256').update(content.replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);
}

/** `{ 'es': '…', 'showroom/es': '…' }`, con la ruta que pide el loader y en orden. */
export async function dictionaryVersions(root = ROOT) {
  const base = path.join(root, DICTIONARIES);
  const versions = {};
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith('.json')) {
        const key = path.relative(base, full).replace(/\\/g, '/').replace(/\.json$/, '');
        versions[key] = fingerprint(await readFile(full, 'utf8'));
      }
    }
  }
  await walk(base);
  return versions;
}

/** El archivo generado, byte por byte: la compuerta lo compara contra el versionado. */
export function renderVersions(versions) {
  const lines = Object.keys(versions)
    .sort()
    .map((key) => `  '${key}': '${versions[key]}',`);
  return [
    '// Generado por tools/i18n/dictionary-versions.mjs (`npm run i18n:versions`). No se edita a mano.',
    'export const DICTIONARY_VERSIONS: Readonly<Record<string, string>> = {',
    ...lines,
    '};',
    '',
  ].join('\n');
}

/** Lo que la regla 12 reporta: nada si la tabla versionada es la que salen de los diccionarios. */
export async function checkDictionaryVersions(root = ROOT) {
  const expected = renderVersions(await dictionaryVersions(root));
  let committed;
  try {
    committed = await readFile(path.join(root, OUTPUT), 'utf8');
  } catch {
    return ['is missing. Run `npm run i18n:versions` and commit it.'];
  }
  return committed.replace(/\r\n/g, '\n') === expected
    ? []
    : ['is stale: a dictionary changed. Run `npm run i18n:versions` and commit it.'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = renderVersions(await dictionaryVersions());
  await writeFile(path.join(ROOT, OUTPUT), source, 'utf8');
  console.log(`i18n: wrote ${OUTPUT}.`);
}
