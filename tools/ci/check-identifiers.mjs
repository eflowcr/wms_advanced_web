/**
 * Identificadores en inglés: recorre el AST de TypeScript de projects/ y e2e/ y rechaza nombres
 * declarados y de archivo con una raíz en español de la lista. No mira cadenas ni comentarios.
 * Ver vault: 08-Sistema-de-Diseno/Nomenclatura de Componentes y Tokens.md.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIRS = ['projects', 'e2e'];
const SKIPPED_DIRS = new Set(['node_modules', 'dist']);

/**
 * Cada raíz es una palabra española con su familia; una palabra del identificador coincide entera.
 * Fuera a propósito: `el` (abreviatura de element), `es`/`en` (códigos de idioma), `sin` (seno).
 */
export const SPANISH_ROOTS = [
  'abrir',
  'accion(?:es)?',
  'activ[ao]s?',
  'activad[ao]s?',
  'almacen(?:es)?',
  'altas?',
  'alternar',
  'aplicar',
  'articulos?',
  'avanzad[ao]s?',
  'bodegas?',
  'bultos?',
  'busquedas?',
  'cabeceras?',
  'campos?',
  'cargad[ao]s?',
  'cargar',
  'claves?',
  'clientes?',
  'codigos?',
  'compact[ao]s?',
  'completad[ao]s?',
  'con',
  'consultas?',
  'correos?',
  'crear',
  'cuant[ao]s',
  'descargas?',
  'descargar',
  'detalles?',
  'ejemplos?',
  'elegid[ao]s?',
  'elegir',
  'entregas?',
  'estados?',
  'etiquetas?',
  'expedicion(?:es)?',
  'falla',
  'fechas?',
  'filas?',
  'filtrar',
  'fuentes?',
  'generar',
  'guardad[ao]s?',
  'guardar',
  'hij[ao]s?',
  'indices?',
  'ir',
  'isotipos?',
  'limpiar',
  'lineas?',
  'lotes?',
  'maestr[ao]s?',
  'masiv[ao]s?',
  'muestras?',
  'nivel(?:es)?',
  'ocupacion(?:es)?',
  'pagina(?:s|d[ao]s?)?',
  'pasillos?',
  'pedid[ao]s?',
  'pendientes?',
  'perezos[ao]s?',
  'periodos?',
  'por',
  'que',
  'reetiquetar',
  'respuestas?',
  'resumen(?:es)?',
  'retrasos?',
  'salir',
  'seleccion(?:es|ad[ao]s?|ar)?',
  'serie',
  'textos?',
  'tipos?',
  'tod[ao]s?',
  'ubicacion(?:es)?',
  'ultim[ao]s?',
  'urgentes?',
  'usar',
  'vaci[ao]s?',
  'valor(?:es)?',
];

const SPANISH = new RegExp(`^(?:${SPANISH_ROOTS.join('|')})$`);

/** Las palabras de un nombre: camelCase, PascalCase, SNAKE_CASE y kebab-case, en minúsculas. */
export function words(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** La primera palabra española de un nombre, o null. */
export function spanishWord(name) {
  return words(name).find((word) => SPANISH.test(word)) ?? null;
}

/** El nombre que declara un nodo, si declara uno con identificador. */
function declaredName(node) {
  if (
    ts.isClassDeclaration(node) ||
    ts.isClassExpression(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isEnumMember(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isParameter(node) ||
    ts.isBindingElement(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isPropertyAssignment(node) ||
    ts.isShorthandPropertyAssignment(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isTypeParameterDeclaration(node) ||
    ts.isImportSpecifier(node) ||
    ts.isImportClause(node) ||
    ts.isNamespaceImport(node) ||
    ts.isExportSpecifier(node)
  ) {
    const name = node.name;
    if (name && (ts.isIdentifier(name) || ts.isPrivateIdentifier(name))) {
      return name;
    }
  }
  return null;
}

/** Los identificadores españoles que declara un fuente: `{ name, word, line }`. */
export function spanishDeclarations(content, file = 'source.ts') {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const found = [];
  const visit = (node) => {
    const name = declaredName(node);
    if (name !== null) {
      const word = spanishWord(name.text);
      if (word !== null) {
        const { line } = source.getLineAndCharacterOfPosition(name.getStart(source));
        found.push({ name: name.text, word, line: line + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) files.push(...listFiles(relative));
    } else if (entry.name.endsWith('.ts')) {
      files.push(relative);
    }
  }
  return files;
}

/** Cada nombre de archivo o identificador en español de projects/ y e2e/. */
export function findSpanishIdentifiers() {
  const found = [];
  for (const file of SCAN_DIRS.flatMap(listFiles).sort()) {
    const word = spanishWord(path.basename(file));
    if (word !== null) found.push({ file, line: 1, name: path.basename(file), word });
    for (const hit of spanishDeclarations(readFileSync(path.join(ROOT, file), 'utf8'), file)) {
      found.push({ file, ...hit });
    }
  }
  return found;
}

function main() {
  const found = findSpanishIdentifiers();
  if (found.length === 0) {
    console.log(`Identifiers: no Spanish name in ${SCAN_DIRS.join('/ and ')}/.`);
    return;
  }
  for (const { file, line, name, word } of found) {
    const message = `\`${name}\` is Spanish («${word}»). Identifiers are in English; text lives in the dictionaries.`;
    console.error(
      process.env.GITHUB_ACTIONS ? `::error file=${file},line=${line}::${message}` : `${file}:${line} ${message}`,
    );
  }
  console.error(`\nIdentifiers: ${found.length} Spanish name(s).`);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
