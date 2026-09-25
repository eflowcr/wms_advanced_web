/**
 * Pruebas de la regla 15: solo el sistema de diseño. node:test sin Angular;
 * `npm run test:tools` (parte de `npm test`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkFile,
  EXEMPT,
  findNativeControls,
  NATIVE_CONTROLS,
} from './check-design-system-only.mjs';

const elements = (template) => findNativeControls(template).map(({ element }) => element);
const lines = (file, content) => checkFile(file, content).map(({ line }) => line);

describe('findNativeControls', () => {
  for (const name of NATIVE_CONTROLS) {
    it(`flags a native <${name}>`, () => {
      const template = name === 'input' ? '<input type="search" />' : `<${name}></${name}>`;
      assert.deepEqual(elements(template), [name]);
    });
  }

  it('passes the design system components and plain links', () => {
    assert.deepEqual(
      elements(`<ewms-button variant="link">x</ewms-button><ewms-input label="x" />
        <ewms-select label="x" /><a routerLink="/design-system">x</a>`),
      [],
    );
  });

  it('ignores an HTML comment that names a control without being one', () => {
    assert.deepEqual(elements('<!-- Un <button> nativo acá perdería el anillo de foco. -->'), []);
  });

  it('finds controls inside control flow and ng-template', () => {
    assert.deepEqual(
      elements('@if (a) { <select></select> } <ng-template><textarea></textarea></ng-template>'),
      ['select', 'textarea'],
    );
  });

  it('reports the line of each finding', () => {
    const [finding] = findNativeControls('<div>\n\n  <button type="button">x</button>\n</div>');
    assert.equal(finding?.line, 3);
  });
});

describe('checkFile', () => {
  it('flags an inline template at the line of the file where the control is', () => {
    const source =
      "@Component({\n  selector: 'x',\n  template: `<p>\n  <input /></p>`,\n})\nclass A {}\n";
    assert.deepEqual(lines('projects/shell/src/app/a.ts', source), [4]);
  });

  it('does not look inside the design system library', () => {
    assert.deepEqual(
      lines('projects/design-system/src/lib/button/button.html', '<button></button>'),
      [],
    );
  });

  it('exempts the host page of the shell entirely', () => {
    assert.deepEqual(
      lines('projects/shell/src/index.html', '<button type="button">Reintentar</button>'),
      [],
    );
  });

  it('exempts only <table> in the showroom documentation widgets', () => {
    assert.deepEqual(lines('projects/showroom/src/lib/ui/prop-table.html', '<table></table>'), []);
    assert.deepEqual(
      lines('projects/showroom/src/lib/ui/prop-table.html', '<table></table>\n<button></button>'),
      [2],
    );
  });

  it('does not exempt a <table> in a showroom page', () => {
    assert.deepEqual(
      lines('projects/showroom/src/lib/pages/components/button.html', '<table></table>'),
      [1],
    );
  });

  it('writes a reason next to every exemption', () => {
    for (const { prefix, reason } of EXEMPT) {
      assert.ok(reason.length > 40, `${prefix} needs a written reason`);
    }
  });
});
