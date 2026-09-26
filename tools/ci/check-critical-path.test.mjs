import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CEILING_KB, criticalPath, ROUTE_ENTRIES } from './check-critical-path.mjs';

const [MAIN, LAYOUT, HOME] = ROUTE_ENTRIES;
const METAFILE = {
  outputs: {
    'main.js': {
      entryPoint: MAIN,
      imports: [
        { path: 'core.js', kind: 'import-statement' },
        { path: 'layout.js', kind: 'dynamic-import' },
      ],
    },
    'core.js': { imports: [] },
    'layout.js': {
      entryPoint: LAYOUT,
      imports: [
        { path: 'core.js', kind: 'import-statement' },
        { path: 'shared.js', kind: 'import-statement' },
        { path: 'catalog.js', kind: 'dynamic-import' },
      ],
    },
    'shared.js': { imports: [{ path: 'nested.js', kind: 'import-statement' }] },
    'nested.js': { imports: [] },
    'home.js': { entryPoint: HOME, imports: [{ path: 'shared.js', kind: 'import-statement' }] },
    'catalog.js': { entryPoint: 'projects/showroom/src/lib/catalog.ts', imports: [] },
  },
};

describe('criticalPath', () => {
  it('follows static imports from the three entries, once each', () => {
    assert.deepEqual(criticalPath(METAFILE).sort(), [
      'core.js',
      'home.js',
      'layout.js',
      'main.js',
      'nested.js',
      'shared.js',
    ]);
  });

  it('leaves out what is only loaded dynamically', () => {
    assert.equal(criticalPath(METAFILE).includes('catalog.js'), false);
  });

  it('fails loud when an entry has no output, instead of measuring less', () => {
    assert.throws(
      () => criticalPath(METAFILE, [MAIN, 'projects/shell/src/app/gone.ts']),
      /gone\.ts/,
    );
  });

  it('writes its ceiling in one place, as a number of kB', () => {
    assert.equal(Number.isInteger(CEILING_KB), true);
  });
});
