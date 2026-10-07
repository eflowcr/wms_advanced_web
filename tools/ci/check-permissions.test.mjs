// La compuerta de catálogo, ejercitada (PACQ-07): falla con lo que tiene que fallar y deja pasar lo
// correcto. `npm run test:tools`. Ver vault: 04-Requisitos/REQ-FE-SEC-002.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { catalogCodes, checkCodes, checkTemplate } from './check-permissions.mjs';

const known = catalogCodes();
const problems = (template) => checkTemplate(template, { known }).map((p) => p.message);

describe('the catalog', () => {
  it('speaks module.option:action and holds the security actions', () => {
    for (const code of [
      'security.users:access',
      'security.users:create',
      'security.users:update',
      'security.users:deactivate',
      'security.users:export',
      'security.profiles:update',
      'security.profiles:assign',
      'security.profiles:inspect',
      'catalogs.articles:access',
      'settings.params:access',
    ]) {
      assert.ok(known.has(code), code);
    }
  });
});

describe('a button with an effect in a domain', () => {
  it('fails outside *ewmsCan', () => {
    assert.equal(problems(`<ewms-button (click)="save()">Guardar</ewms-button>`).length, 1);
  });

  it('fails when hidden only by @if: the gate is the directive', () => {
    const template = `@if (access.can('security.users:create')) { <ewms-button>Crear</ewms-button> }`;
    assert.equal(problems(template).length, 1);
  });

  it('passes under *ewmsCan, on itself or on an ancestor, through blocks', () => {
    assert.deepEqual(
      problems(`<ewms-button *ewmsCan="'security.users:create'">C</ewms-button>`),
      [],
    );
    assert.deepEqual(
      problems(
        `<div *ewmsCan="'security.profiles:assign'">@if (x) { <ewms-button>A</ewms-button> }</div>`,
      ),
      [],
    );
  });

  it('passes when declared without effect', () => {
    assert.deepEqual(problems(`<ewms-button data-effect="none">Cancelar</ewms-button>`), []);
  });

  it('passes with a choice between catalog codes', () => {
    const template = `<ewms-button *ewmsCan="isNew ? 'security.users:create' : 'security.users:update'">G</ewms-button>`;
    assert.deepEqual(problems(template), []);
  });
});

describe('a code', () => {
  it('fails in *ewmsCan when it is not in the catalog, or when there is none', () => {
    assert.equal(
      problems(`<ewms-button *ewmsCan="'security.users:craete'">C</ewms-button>`).length,
      1,
    );
    assert.equal(problems(`<ewms-button *ewmsCan="code">C</ewms-button>`).length, 1);
  });

  it('fails anywhere it is quoted and not in the catalog', () => {
    assert.equal(checkCodes(`this.access.can('security.users:delete')`, known).length, 1);
    assert.deepEqual(checkCodes(`this.access.can('security.users:export')`, known), []);
    assert.deepEqual(checkCodes(`const type = 'urn:ewms:security:denied';`, known), []);
  });
});
