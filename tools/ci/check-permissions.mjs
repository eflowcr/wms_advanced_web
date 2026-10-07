/**
 * Compuerta de catálogo (REQ-FE-SEC-002 RFE-03, PACQ-07): todo botón con efecto de un dominio va
 * bajo `*ewmsCan` o se declara sin efecto, y todo código citado existe en el catálogo.
 * `npm run lint:permissions`. Ver vault: 03-Modulos/Seguridad.md.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseTemplate, TmplAstRecursiveVisitor, tmplAstVisitAll } from '@angular/compiler';
import ts from 'typescript';
import { inlineTemplates } from './check-i18n.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** El catálogo, leído del código que lo declara: transpilado, sin depender de su sintaxis. */
const CATALOG = path.join(ROOT, 'projects/core/src/lib/security/access.ts');
const { outputText } = ts.transpileModule(readFileSync(CATALOG, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { capabilities } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

/** Dónde se exige: las pantallas de dominio. */
const BUTTONS_IN = 'projects/domains/';
/** Dónde se valida todo código citado: dominios, la seguridad de core y el shell. */
const CODES_IN = ['projects/domains/', 'projects/core/src/lib/security/', 'projects/shell/src/'];

/** Un botón que no escribe nada (cancelar, recargar, cerrar) lo declara en su plantilla. */
const NO_EFFECT = 'data-effect';
const BUTTONS = new Set(['ewms-button', 'ewms-split-button']);
const CODE = /^[a-z][a-z-]*\.[a-z][a-z-]*:[a-z][a-z-]*$/;
const QUOTED = /(['"`])([a-z][a-z-]*\.[a-z][a-z-]*:[a-z][a-z-]*)\1/g;

const lineOf = (node) => (node.sourceSpan?.start.line ?? 0) + 1;

class PermissionVisitor extends TmplAstRecursiveVisitor {
  constructor(known, requireGate) {
    super();
    this.known = known;
    this.requireGate = requireGate;
    this.gated = 0;
    this.found = [];
  }

  visitTemplate(template) {
    const gate = (template.templateAttrs ?? []).find((attribute) => attribute.name === 'ewmsCan');
    if (!gate) return super.visitTemplate(template);
    const source = gate.value?.source ?? '';
    const codes = [...source.matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2]);
    if (codes.length === 0) {
      this.found.push({
        line: lineOf(gate),
        message: `*ewmsCan="${source}" names no literal code`,
      });
    }
    for (const code of codes) {
      if (!this.known.has(code)) {
        this.found.push({
          line: lineOf(gate),
          message: `*ewmsCan names "${code}", not in the catalog`,
        });
      }
    }
    this.gated++;
    super.visitTemplate(template);
    this.gated--;
  }

  visitElement(element) {
    const noEffect = (element.attributes ?? []).some(
      (attribute) => attribute.name === NO_EFFECT && attribute.value === 'none',
    );
    if (this.requireGate && BUTTONS.has(element.name) && this.gated === 0 && !noEffect) {
      this.found.push({
        line: lineOf(element),
        message: `<${element.name}> with an effect outside *ewmsCan (or declare ${NO_EFFECT}="none")`,
      });
    }
    super.visitElement(element);
  }
}

/** Los problemas de una plantilla: botones sin compuerta y códigos fuera del catálogo. */
export function checkTemplate(template, { known, requireGate = true, url = 'template.html' }) {
  const parsed = parseTemplate(template, url, { preserveWhitespaces: false });
  const visitor = new PermissionVisitor(known, requireGate);
  tmplAstVisitAll(visitor, parsed.nodes);
  return [
    ...(parsed.errors ?? []).map((error) => ({
      line: (error.span?.start.line ?? 0) + 1,
      message: `template does not parse: ${error.msg}`,
    })),
    ...visitor.found,
  ];
}

/** Todo código citado entre comillas, en TypeScript o en una plantilla, existe en el catálogo. */
export function checkCodes(source, known) {
  const found = [];
  for (const match of source.matchAll(QUOTED)) {
    if (!known.has(match[2])) {
      found.push({
        line: source.slice(0, match.index).split('\n').length,
        message: `"${match[2]}" is not in the catalog`,
      });
    }
  }
  return found;
}

export function catalogCodes() {
  return new Set(capabilities().filter((code) => CODE.test(code)));
}

async function main() {
  const known = catalogCodes();
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'projects'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => /\.(ts|html)$/.test(file) && !/\.spec\.ts$/.test(file));
  const problems = [];
  for (const file of files) {
    const scanCodes = CODES_IN.some((prefix) => file.startsWith(prefix));
    const domain = file.startsWith(BUTTONS_IN);
    if (!scanCodes && !domain) continue;
    const source = await readFile(path.join(ROOT, file), 'utf8');
    const report = (list, offset = 0) =>
      list.forEach(({ line, message }) => problems.push(`${file}:${line + offset} ${message}`));
    if (scanCodes) report(checkCodes(source, known));
    if (!domain) continue;
    if (file.endsWith('.html')) report(checkTemplate(source, { known, url: file }));
    else
      for (const { template, line } of inlineTemplates(source))
        report(checkTemplate(template, { known, url: file }), line - 1);
  }
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    console.error(`permissions: ${problems.length} problem(s). See REQ-FE-SEC-002 RFE-03.`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `permissions: ${known.size} catalog codes; every domain button is gated or declared.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
