// Cada frontera de Anatomía y Estructura §2, probada con ESLint sobre rutas virtuales: una sonda
// permitida y una prohibida por biblioteca. Ver vault: 02-Arquitectura/Anatomia del Workspace.md.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { DOMAINS } = createRequire(import.meta.url)(path.join(ROOT, 'eslint.config.js'));
const eslint = new ESLint({ cwd: ROOT });

/** Los errores de frontera que da ESLint a un import desde un archivo de una biblioteca. */
async function boundaryErrors(file, specifier) {
  const [result] = await eslint.lintText(`import '${specifier}';\n`, {
    filePath: path.join(ROOT, file),
  });
  return result.messages.filter((m) => m.severity === 2 && /no-restricted-imports$/.test(m.ruleId));
}

const allows = (file, specifier) =>
  it(`${file} may import ${specifier}`, async () => {
    assert.deepEqual(await boundaryErrors(file, specifier), []);
  });

const forbids = (file, specifier) =>
  it(`${file} may NOT import ${specifier}`, async () => {
    assert.notEqual((await boundaryErrors(file, specifier)).length, 0);
  });

const DS = 'projects/design-system/src/lib/probe.ts';
const SHOWROOM = 'projects/showroom/src/lib/probe.ts';
const CORE = 'projects/core/src/lib/probe.ts';
const SHELL = 'projects/shell/src/app/probe.ts';
const SHARED = 'projects/shared/src/lib/probe.ts';
const API = 'projects/api-client/src/probe.ts';
const TESTING = 'projects/testing/src/lib/probe.ts';
const DOMAIN = 'projects/domains/inventory/src/lib/probe.ts';

describe('the domain aliases', () => {
  it('are the eight of Estructura §2, in one list', () => {
    assert.deepEqual(DOMAINS, [
      '@ewms/inventory',
      '@ewms/security',
      '@ewms/kardex',
      '@ewms/decisions',
      '@ewms/audit',
      '@ewms/outbox',
      '@ewms/extensibility',
      '@ewms/tasks',
    ]);
  });
});

describe('shell: everything, but never @ewms/testing in production', () => {
  allows(SHELL, '@ewms/design-system');
  allows(SHELL, '@ewms/showroom');
  allows(SHELL, '@ewms/core');
  allows(SHELL, '@ewms/inventory');
  forbids(SHELL, '@ewms/testing');
  allows('projects/shell/src/app/probe.spec.ts', '@ewms/testing');
});

describe('showroom: design-system and shared', () => {
  allows(SHOWROOM, '@ewms/design-system');
  allows(SHOWROOM, '@ewms/shared');
  forbids(SHOWROOM, '@ewms/core');
  forbids(SHOWROOM, '@ewms/api-client');
  forbids(SHOWROOM, '@ewms/testing');
});

describe('design-system: shared, and no router nor translation library', () => {
  allows(DS, '@ewms/shared');
  allows(DS, '@angular/cdk/overlay');
  forbids(DS, '@ewms/core');
  forbids(DS, '@ewms/api-client');
  forbids(DS, '@ewms/showroom');
  forbids(DS, '@angular/router');
  forbids(DS, '@jsverse/transloco');
});

describe('core: shared and api-client', () => {
  allows(CORE, '@ewms/shared');
  allows(CORE, '@ewms/api-client');
  forbids(CORE, '@ewms/design-system');
  forbids(CORE, '@ewms/showroom');
});

describe('shared and api-client: nothing from the workspace', () => {
  allows(SHARED, '@angular/router');
  forbids(SHARED, '@ewms/core');
  forbids(API, '@ewms/shared');
});

describe('testing: everything, it is dev only', () => {
  allows(TESTING, '@ewms/core');
  allows(TESTING, '@ewms/design-system');
});

describe('a domain: design-system, core, shared and api-client, never another domain', () => {
  allows(DOMAIN, '@ewms/design-system');
  allows(DOMAIN, '@ewms/core');
  allows(DOMAIN, '@ewms/shared');
  allows(DOMAIN, '@ewms/api-client');
  forbids(DOMAIN, '@ewms/kardex');
  forbids(DOMAIN, '@ewms/showroom');
  forbids(DOMAIN, '@ewms/testing');
});

describe('no library below the shell reaches a domain', () => {
  for (const file of [DS, SHOWROOM, CORE, SHARED, API]) {
    for (const domain of DOMAINS) {
      forbids(file, domain);
    }
  }
});

describe('a spec imports what its code imports, plus @ewms/testing', () => {
  allows('projects/design-system/src/lib/probe.spec.ts', '@ewms/testing');
  forbids('projects/design-system/src/lib/probe.spec.ts', '@ewms/core');
  forbids('projects/showroom/src/lib/probe.spec.ts', '@ewms/newlib');
  forbids('projects/core/src/lib/probe.spec.ts', '@ewms/inventory');
});

describe('nobody goes past a public-api.ts', () => {
  forbids(SHELL, '@ewms/design-system/src/lib/button/button');
  forbids(SHELL, '../../../design-system/src/lib/button/button');
});
