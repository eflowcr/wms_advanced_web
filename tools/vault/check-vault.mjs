/**
 * Compuertas del vault: enlaces, redacción, frontmatter, tokens y las referencias del repositorio.
 * `npm run vault:check -- <ruta-al-vault>`: sale 0 en verde, 1 con hallazgos y 2 si no puede correr.
 * Ver vault: CLAUDE.md.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { citedColorTokens, definedColorTokens } from './check-token-names.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOKENS_FILE = 'projects/design-system/src/styles/tokens.css';

/** Gobierno es de otro equipo y no se revisa; la única nota nuestra adentro sí. */
const GOVERNANCE = '00-Gobierno/';
const OURS_IN_GOVERNANCE = '00-Gobierno/Que nos obliga a nosotros.md';
const PROMPTS = '07-Recursos/Prompts/';
const TEMPLATES = '_meta/';
const PENDING_NOTE = '01-Proyecto/Pendientes.md';
const ARCHIVE = '99-Archivo';

// ------------------------------------------------------------------ el vault

const fold = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/** Todo archivo del vault fuera de las carpetas de herramientas (`.obsidian`, `.claude`). */
export function listVault(vault, dir = '') {
  const files = [];
  for (const entry of readdirSync(path.join(vault, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relative = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listVault(vault, relative));
    else files.push(relative);
  }
  return files;
}

/** Una nota viva: la describe el estado actual y la miran las compuertas. */
export function isLive(file) {
  if (!file.endsWith('.md')) return false;
  if (file.startsWith(GOVERNANCE)) return file === OURS_IN_GOVERNANCE;
  return !file.startsWith(TEMPLATES);
}

/** El texto sin bloques de código ni código en línea, con las líneas en su lugar. */
export function withoutCode(text) {
  return withoutFences(text).replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length));
}

/** El texto sin bloques de código cercados, con el código en línea y las líneas en su lugar. */
export function withoutFences(text) {
  return text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, (block) => block.replace(/[^\n]/g, ' '));
}

/** Frontmatter y cuerpo; `fields` es null si la nota no abre con `---`. */
export function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { fields: null, body: text, offset: 0 };
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (pair) fields[pair[1]] = pair[2].trim();
  }
  return { fields, body: text.slice(match[0].length), offset: match[0].split('\n').length - 1 };
}

/** Los encabezados ATX de una nota, fuera de bloques de código. */
export function headings(text) {
  return withoutCode(text)
    .split('\n')
    .map((line) => /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1])
    .filter(Boolean)
    .map((heading) => heading.replace(/`/g, ''));
}

// Los encabezados de las líneas de código se leen del texto crudo: la ruta sale en código en línea.
function rawHeadings(text) {
  return text
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')
    .split('\n')
    .map((line) => /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1])
    .filter(Boolean);
}

/** Como compara Obsidian un encabezado: sin formato, sin los caracteres que no admite un enlace. */
export function headingKey(text) {
  return fold(text)
    .replace(/[`*_\\]/g, '')
    .replace(/[:#^|[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------------ enlaces

/** Los `[[wikilinks]]` de un texto, con su línea: destino, encabezados y si es un embebido. */
export function wikilinks(text) {
  const found = [];
  const clean = withoutCode(text);
  for (const match of clean.matchAll(/(!?)\[\[([^\]\n]+?)\]\]/g)) {
    const inner = match[2].replace(/\\\|/g, '|');
    const [reference] = inner.split('|');
    const [target, ...sections] = reference.split('#');
    found.push({
      target: target.trim(),
      sections: sections.map((section) => section.trim()).filter(Boolean),
      embed: match[1] === '!',
      line: clean.slice(0, match.index).split('\n').length,
    });
  }
  return found;
}

/** Resuelve un destino como Obsidian: relativo a la nota, desde la raíz o por nombre de archivo. */
export function resolveTarget(files, from, target) {
  if (target === '') return from;
  const lower = new Map(files.map((file) => [file.toLowerCase(), file]));
  const withMd = (candidate) =>
    lower.get(candidate.toLowerCase()) ?? lower.get(`${candidate}.md`.toLowerCase()) ?? null;
  if (target.includes('/')) {
    const relative = path.posix.normalize(`${path.posix.dirname(from)}/${target}`);
    return withMd(relative) ?? withMd(path.posix.normalize(target)) ?? null;
  }
  const byName = files.filter((file) => {
    const base = path.posix.basename(file).toLowerCase();
    return base === target.toLowerCase() || base === `${target}.md`.toLowerCase();
  });
  return byName.sort((a, b) => a.length - b.length)[0] ?? null;
}

export function checkLinks(vault, files, live) {
  const problems = [];
  for (const note of live) {
    const text = readFileSync(path.join(vault, note), 'utf8');
    for (const link of wikilinks(text)) {
      const target = resolveTarget(files, note, link.target);
      if (target === null) {
        problems.push(`${note}:${link.line} [[${link.target}]] does not resolve to a note`);
        continue;
      }
      if (link.sections.length === 0 || !target.endsWith('.md')) continue;
      const targetText = readFileSync(path.join(vault, target), 'utf8');
      const keys = new Set([...headings(targetText), ...rawHeadings(targetText)].map(headingKey));
      for (const section of link.sections) {
        if (section.startsWith('^')) {
          if (!targetText.includes(section)) problems.push(`${note}:${link.line} [[${link.target}#${section}]] has no such block`);
        } else if (!keys.has(headingKey(section))) {
          problems.push(`${note}:${link.line} [[${link.target}#${section}]] has no such heading`);
        }
      }
    }
  }
  return problems;
}

// ------------------------------------------------------------------ redacción

const WORD = (pattern) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`, 'giu');

/** Lo que una nota viva no dice: cuenta cómo es el sistema, nunca cómo llegó a serlo. */
export const FORBIDDEN = [
  { phrase: 'antes', pattern: WORD('antes(?!\\s+(?:de|que)(?![\\p{L}]))') },
  { phrase: 'ahora es', pattern: WORD('ahora es') },
  { phrase: 'ya no', pattern: WORD('ya no') },
  { phrase: 'pasó a', pattern: WORD('pasó a|paso a (?:ser|llamarse|usar|vivir|estar)') },
  { phrase: 'se cambió', pattern: WORD('se cambi[óo]') },
  { phrase: 'originalmente', pattern: WORD('originalmente') },
  { phrase: 'anteriormente', pattern: WORD('anteriormente') },
  { phrase: 'en su momento', pattern: WORD('en su momento') },
  { phrase: 'desde B…', pattern: WORD('desde (?:B|DS-)\\d+') },
  { phrase: 'desde/hasta una fecha', pattern: WORD('(?:desde|hasta) el \\d{4}-\\d{2}-\\d{2}') },
  { phrase: 'estado al…', pattern: WORD('estado al \\d{4}-\\d{2}-\\d{2}') },
  { phrase: 'Historial', pattern: /^#{1,6}[ \t]+Historial\b/gmu },
  { phrase: 'en la rama', pattern: WORD('en la rama') },
  { phrase: 'PR #', pattern: /(?<![\p{L}\p{N}_])PR\s*#/gu },
  // Una rama se nombra también entre comillas invertidas: esta frase se busca con el código en línea.
  { phrase: 'STG-… (rama)', pattern: /(?<![\p{L}\p{N}_-])STG-[A-Z0-9]/gu, inline: true },
  { phrase: '(pendiente)', pattern: /\(\s*pendiente[^)]*\)/giu, pending: true },
  { phrase: 'pendiente de', pattern: WORD('pendientes? de'), pending: true },
  { phrase: 'por confirmar', pattern: WORD('por confirmar') },
  { phrase: 'probablemente', pattern: WORD('probablemente') },
  { phrase: 'quizá', pattern: WORD('quiz[áa]s?') },
  { phrase: 'tal vez', pattern: WORD('tal vez') },
  { phrase: 'duda', pattern: WORD('dudas?') },
  { phrase: 'no verificado', pattern: WORD('no verificad[oa]s?') },
  { phrase: 'sin verificar', pattern: WORD('sin verificar') },
];

/** Las frases prohibidas de un texto, con su línea. La nota de pendientes puede decir «pendiente». */
export function forbiddenPhrases(text, { pendingNote = false } = {}) {
  const { body, offset } = frontmatter(text);
  const clean = withoutCode(body);
  const withInlineCode = withoutFences(body);
  const found = [];
  for (const { phrase, pattern, pending, inline } of FORBIDDEN) {
    if (pending && pendingNote) continue;
    const scanned = inline ? withInlineCode : clean;
    for (const match of scanned.matchAll(pattern)) {
      const line = offset + scanned.slice(0, match.index).split('\n').length;
      found.push({ phrase, line, text: match[0], index: match.index });
    }
  }
  return found.sort((a, b) => a.index - b.index).map(({ phrase, line, text }) => ({ phrase, line, text }));
}

export function checkWording(vault, live) {
  const problems = [];
  if (existsSync(path.join(vault, ARCHIVE))) problems.push(`${ARCHIVE}/ exists: history lives in git, not in the vault`);
  for (const note of live) {
    if (note.startsWith(PROMPTS)) continue;
    const text = readFileSync(path.join(vault, note), 'utf8');
    for (const { phrase, line, text: hit } of forbiddenPhrases(text, { pendingNote: note === PENDING_NOTE })) {
      problems.push(`${note}:${line} «${hit}» (${phrase})`);
    }
  }
  return problems;
}

// ------------------------------------------------------------------ frontmatter

/** Campos y estados válidos, leídos del CLAUDE.md del vault: su bloque yaml y su tabla de estados. */
export function frontmatterRules(claude) {
  const yaml = /```yaml\r?\n([\s\S]*?)```/.exec(claude)?.[1];
  if (!yaml) throw new Error('CLAUDE.md has no ```yaml block with the frontmatter');
  const lines = yaml.split(/\r?\n/).filter((line) => /^[a-z_]+:/.test(line));
  const fields = lines.map((line) => line.split(':')[0]);
  const values = (key) =>
    (lines.find((line) => line.startsWith(`${key}:`)) ?? '')
      .slice(key.length + 1)
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean);
  const statuses = new Set(values('status'));
  for (const row of claude.matchAll(/^\|\s*`([a-z]+)`\s*\|/gm)) statuses.add(row[1]);
  return { fields, types: new Set(values('type')), statuses };
}

export function frontmatterProblems(text, rules) {
  const { fields } = frontmatter(text);
  if (fields === null) return ['no frontmatter'];
  const problems = [];
  for (const field of rules.fields) {
    if (!(field in fields)) problems.push(`missing \`${field}\``);
  }
  if ('type' in fields && !rules.types.has(fields.type)) problems.push(`type \`${fields.type}\` is not one of CLAUDE.md`);
  if ('status' in fields && !rules.statuses.has(fields.status)) problems.push(`status \`${fields.status}\` is not one of CLAUDE.md`);
  for (const date of ['created', 'updated']) {
    if (date in fields && !/^\d{4}-\d{2}-\d{2}$/.test(fields[date])) problems.push(`${date} \`${fields[date]}\` is not AAAA-MM-DD`);
  }
  if (fields.created && fields.updated && fields.updated < fields.created) problems.push('updated is before created');
  if (fields.type === 'adr' && !['aceptada', 'propuesta'].includes(fields.decision_status ?? '')) {
    problems.push(`decision_status \`${fields.decision_status ?? ''}\` is not aceptada or propuesta`);
  }
  return problems;
}

export function checkFrontmatter(vault, live) {
  const claudeFile = path.join(vault, 'CLAUDE.md');
  const rules = frontmatterRules(readFileSync(claudeFile, 'utf8'));
  const problems = [];
  for (const note of live) {
    for (const problem of frontmatterProblems(readFileSync(path.join(vault, note), 'utf8'), rules)) {
      problems.push(`${note}: ${problem}`);
    }
  }
  return problems;
}

// ------------------------------------------------------------------ tokens

export function checkTokens(vault, live) {
  const defined = definedColorTokens(readFileSync(path.join(ROOT, TOKENS_FILE), 'utf8'));
  const problems = [];
  for (const note of live) {
    for (const { name, line } of citedColorTokens(readFileSync(path.join(vault, note), 'utf8'))) {
      if (!defined.has(name)) problems.push(`${note}:${line} ${name} is not defined in tokens.css`);
    }
  }
  return problems;
}

// ------------------------------------------------------------------ referencias del código

/** Los nombres por los que el código cita una nota: ruta, nombre, nombre corto y «ADR NNNN». */
export function noteNames(live) {
  const names = new Map();
  const add = (name, note) => {
    const key = fold(name);
    if (!names.has(key)) names.set(key, note);
  };
  for (const note of live) {
    const bare = note.replace(/\.md$/, '');
    const parts = bare.split('/');
    for (let from = 0; from < parts.length; from++) {
      add(parts.slice(from).join('/'), note);
      add(`${parts.slice(from).join('/')}.md`, note);
    }
    const base = parts.at(-1);
    const short = base.split(' - ')[0];
    if (short !== base) add(short, note);
    const adr = /^Decisiones\/(\d{4}) - /.exec(parts.slice(-2).join('/'))?.[1];
    if (adr) add(`ADR ${adr}`, note);
  }
  return names;
}

/** El texto que sigue a «Ver vault:», con las líneas de comentario unidas, hasta el fin de la cita. */
export function referenceText(source, index) {
  // Una cita partida en dos literales (`'…: ' +\n '…'`) se une antes de leerla.
  const raw = source
    .slice(index, index + 400)
    .replace(/['"]\s*\+\s*\r?\n?\s*['"]/g, '')
    .split(/\*\/|-->/)[0]
    .replace(/\r?\n\s*(?:\/\/+|\*(?!\/)|#|<!--)?\s*/g, ' ');
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '(' || c === '«') depth++;
    else if (c === ')' || c === '»') {
      if (depth === 0) return raw.slice(0, i).trim();
      depth--;
    } else if (depth === 0 && (c === ';' || c === "'" || c === '"')) {
      return raw.slice(0, i).trim();
    } else if (depth === 0 && c === '.' && !/^\.md\b/.test(raw.slice(i)) && !/\d/.test(raw[i + 1] ?? '')) {
      return raw.slice(0, i).trim();
    }
  }
  return raw.trim();
}

const IGNORED_PART = /^(?:regla \d+|nota del .*|\d{4}-\d{2}-\d{2}|lo afirma .*|v\d.*)$/i;

/** Las citas de una referencia: `{ note, sections, headings }`, o `{ unresolved }` si no hay nota. */
export function parseReference(text, names) {
  const refs = [];
  let rest = text;
  const sorted = [...names.keys()].sort((a, b) => b.length - a.length);
  while (rest.trim()) {
    rest = rest.replace(/^\s*(?:,|\by\b)?\s*/u, '');
    if (!rest) break;
    const folded = fold(rest);
    const name = sorted.find((candidate) => folded.startsWith(candidate) && /^(?:$|[\s.,;§(«)])/u.test(folded.slice(candidate.length)));
    if (name) {
      const ref = { note: names.get(name), sections: [], headings: [] };
      rest = rest.slice(name.length);
      for (;;) {
        const section = /^\s*(?:y\s+)?§\s*([\d.]*\d)/u.exec(rest);
        const quoted = /^\s*«([^»]+)»/u.exec(rest) ?? /^\s*,\s*«([^»]+)»/u.exec(rest);
        const paren = /^\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/u.exec(rest);
        if (section) {
          ref.sections.push(section[1]);
          rest = rest.slice(section[0].length);
        } else if (quoted) {
          ref.headings.push(quoted[1]);
          rest = rest.slice(quoted[0].length);
        } else if (paren) {
          const inner = paren[1].trim();
          const numbered = /^(\d+(?:\.\d+)*)\.?(?:,)?\s*(.*)$/.exec(inner);
          if (numbered) {
            ref.sections.push(numbered[1]);
          } else if (!IGNORED_PART.test(inner)) {
            ref.headings.push(inner);
          }
          rest = rest.slice(paren[0].length);
        } else {
          break;
        }
      }
      refs.push(ref);
      continue;
    }
    const part = /^[^,]*?(?=,|\s+y\s+|$)/u.exec(rest)[0];
    if (!IGNORED_PART.test(part.trim())) refs.push({ unresolved: part.trim() });
    rest = rest.slice(part.length);
  }
  return refs;
}

/** Si una nota tiene el encabezado de esa sección (`§4.1` → «4.1 …») o ese texto en uno. */
export function hasSection(noteText, section) {
  const keys = [...headings(noteText), ...rawHeadings(noteText)].map(headingKey);
  return keys.some((key) => new RegExp(`^§?${section.replace(/\./g, '\\.')}(?:[.\\s]|$)`).test(key));
}

export function hasHeading(noteText, heading) {
  const wanted = headingKey(heading);
  return [...headings(noteText), ...rawHeadings(noteText)].some((key) => headingKey(key).includes(wanted));
}

/** Esta compuerta y sus pruebas citan el marcador como dato: no son referencias al vault. */
const SELF = new Set(['tools/vault/check-vault.mjs', 'tools/vault/check-vault.test.mjs']);

function repoFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter((file) => file && /\.(?:ts|mjs|js|html|css|scss|json|md|ya?ml)$|^\.githooks\//.test(file))
    .filter((file) => file !== 'package-lock.json' && !SELF.has(file));
}

export function checkCodeReferences(vault, live) {
  const names = noteNames(live);
  const problems = [];
  for (const file of repoFiles()) {
    const full = path.join(ROOT, file);
    if (!existsSync(full) || statSync(full).size > 2_000_000) continue;
    const source = readFileSync(full, 'utf8');
    const lineOf = (index) => source.slice(0, index).split('\n').length;
    for (const match of source.matchAll(/Ver vault:[ \t]*/g)) {
      const text = referenceText(source, match.index + match[0].length);
      const where = `${file}:${lineOf(match.index)}`;
      if (!text) {
        problems.push(`${where} «Ver vault:» with nothing after it`);
        continue;
      }
      for (const ref of parseReference(text, names)) {
        if (ref.unresolved) {
          problems.push(`${where} «Ver vault: ${text}» → «${ref.unresolved}» is not a note`);
          continue;
        }
        const noteText = readFileSync(path.join(vault, ref.note), 'utf8');
        for (const section of ref.sections) {
          if (!hasSection(noteText, section)) problems.push(`${where} «Ver vault: ${text}» → ${ref.note} has no §${section}`);
        }
        for (const heading of ref.headings) {
          if (!hasHeading(noteText, heading)) problems.push(`${where} «Ver vault: ${text}» → ${ref.note} has no heading «${heading}»`);
        }
      }
    }
    for (const match of source.matchAll(/\bADR (\d{4})\b/g)) {
      if (!names.has(fold(`ADR ${match[1]}`))) problems.push(`${file}:${lineOf(match.index)} ADR ${match[1]} is not in 02-Arquitectura/Decisiones`);
    }
  }
  return problems;
}

// ------------------------------------------------------------------ compuerta

export const CHECKS = [
  ['links', checkLinks],
  ['wording', (vault, files, live) => checkWording(vault, live)],
  ['code references', (vault, files, live) => checkCodeReferences(vault, live)],
  ['frontmatter', (vault, files, live) => checkFrontmatter(vault, live)],
  ['tokens', (vault, files, live) => checkTokens(vault, live)],
];

/** Cada compuerta con sus hallazgos; `only` corre algunas (las pruebas no leen el repositorio). */
export function checkVault(vault, only = CHECKS.map(([name]) => name)) {
  const files = listVault(vault);
  const live = files.filter(isLive);
  return CHECKS.filter(([name]) => only.includes(name)).map(([name, check]) => ({
    name,
    problems: check(vault, files, live),
  }));
}

function main() {
  const vault = process.argv[2];
  if (!vault || !existsSync(path.join(vault, 'CLAUDE.md'))) {
    console.error('Usage: npm run vault:check -- <path-to-vault>   (the folder with CLAUDE.md)');
    process.exitCode = 2;
    return;
  }
  let failed = 0;
  for (const { name, problems } of checkVault(path.resolve(vault))) {
    console.log(`${problems.length === 0 ? 'ok  ' : 'FAIL'} ${name}: ${problems.length} problem(s)`);
    for (const problem of problems) console.log(`     ${problem}`);
    failed += problems.length;
  }
  console.log(failed === 0 ? '\nVault: every check is green.' : `\nVault: ${failed} problem(s).`);
  process.exitCode = failed === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
}
