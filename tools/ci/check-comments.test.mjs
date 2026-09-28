import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { changedLines, commentBlocks, findLongBlocks, longBlocks } from './check-comments.mjs';

const lines = (count, prefix = '') => Array.from({ length: count }, (_, i) => `${prefix}línea ${i + 1}`);

describe('commentBlocks', () => {
  it('joins consecutive // lines into one block and counts only lines with text', () => {
    const source = ['const a = 1;', ...lines(4, '// '), '//', 'const b = 2;', '// sola'].join('\n');
    assert.deepEqual(commentBlocks(source, 'a.ts'), [
      { start: 2, end: 6, textLines: 4 },
      { start: 8, end: 8, textLines: 1 },
    ]);
  });

  it('does not count the delimiters of a /** */ block, nor the star of each line', () => {
    const source = ['/**', ...lines(3, ' * '), ' */', 'export const x = 1;'].join('\n');
    assert.deepEqual(commentBlocks(source, 'a.ts'), [{ start: 1, end: 5, textLines: 3 }]);
    assert.deepEqual(longBlocks(source, 'a.ts'), []);
  });

  it('reads no comment inside a string, a template or a regular expression', () => {
    const source = [
      "const url = 'https://example.com'; // una",
      'const t = `a ${"//"} b // c`;',
      'const r = /\\/\\//g.test(url);',
      'const d = 4 / 2 / 1;',
    ].join('\n');
    assert.deepEqual(commentBlocks(source, 'a.mjs'), [{ start: 1, end: 1, textLines: 1 }]);
  });

  it('reads CSS block comments and not a protocol-relative url', () => {
    const source = ['/*', ...lines(4, ' * '), ' */', ".a { background: url(//x.test/i.png); }"].join('\n');
    assert.deepEqual(commentBlocks(source, 'a.css'), [{ start: 1, end: 6, textLines: 4 }]);
  });

  it('reads HTML and SVG comments', () => {
    const source = ['<div>', '  <!--', ...lines(4, '    '), '  -->', '</div>', '<!-- una -->'].join('\n');
    assert.deepEqual(commentBlocks(source, 'a.html'), [
      { start: 2, end: 7, textLines: 4 },
      { start: 9, end: 9, textLines: 1 },
    ]);
    assert.equal(longBlocks('<svg><!-- a\nb\nc\nd --></svg>', 'b.svg').length, 1);
  });

  it('reads # runs in .yml, .npmrc, .gitignore and the git hooks, and nothing in files it does not own', () => {
    const hash = [...lines(4, '# '), 'key: value'].join('\n');
    for (const file of ['.github/workflows/ci.yml', '.npmrc', '.gitignore', '.githooks/commit-msg']) {
      assert.deepEqual(commentBlocks(hash, file), [{ start: 1, end: 4, textLines: 4 }], file);
    }
    assert.deepEqual(commentBlocks(hash, 'README.md'), []);
  });

  it('exempts the t(…) key markers and the generated icon table, not the prose around them', () => {
    const marker = ['/**', ' * t(a.b, c.d,', ' *   e.f, g.h,', ' *   i.j, k.l)', ' */'].join('\n');
    assert.deepEqual(longBlocks(marker, 'a.ts'), []);
    const prose = ['/**', ...lines(3, ' * '), ' * t(a.b)', ' */'].join('\n');
    assert.deepEqual(commentBlocks(prose, 'a.ts'), [{ start: 1, end: 6, textLines: 3 }]);
    const long = ['/**', ...lines(4, ' * '), ' */'].join('\n');
    assert.deepEqual(commentBlocks(long, 'projects/design-system/src/icons/icons.generated.ts'), []);
  });
});

describe('changedLines', () => {
  it('reads the new side of each hunk, and marks where a deletion happened', () => {
    const diff = [
      'diff --git a/a.ts b/a.ts',
      '--- a/a.ts',
      '+++ b/a.ts',
      '@@ -3,0 +4,2 @@',
      '@@ -10,2 +12,0 @@',
      '@@ -20 +20 @@',
    ].join('\n');
    assert.deepEqual([...changedLines(diff).get('a.ts')].sort((x, y) => x - y), [4, 5, 12, 13, 20]);
  });
});

describe('findLongBlocks --base', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'check-comments-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  const write = (file, content) => writeFileSync(path.join(repo, file), content);
  after(() => rmSync(repo, { recursive: true, force: true }));

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'ci@example.test');
  git('config', 'user.name', 'CI');
  git('config', 'core.autocrlf', 'false');
  const old = ['// vieja', ...lines(4, '// '), 'export const a = 1;', '', 'export const b = 2;'];
  write('old.ts', old.join('\n') + '\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'rama');

  it('leaves alone a long block the branch did not touch', () => {
    write('old.ts', [...old.slice(0, 7), 'export const b = 3;'].join('\n') + '\n');
    assert.deepEqual(findLongBlocks({ cwd: repo, base: 'main' }), []);
    assert.equal(findLongBlocks({ cwd: repo }).length, 1);
  });

  it('reports a long block the branch wrote, committed or not', () => {
    write('new.ts', [...lines(4, '// '), 'export const c = 1;'].join('\n') + '\n');
    assert.deepEqual(
      findLongBlocks({ cwd: repo, base: 'main' }).map(({ file, start }) => `${file}:${start}`),
      ['new.ts:1'],
    );
    git('add', 'new.ts');
    git('commit', '-q', '-m', 'nuevo');
    assert.equal(findLongBlocks({ cwd: repo, base: 'main' }).length, 1);
  });

  it('reports an old long block once the branch touches it', () => {
    write('old.ts', ['// vieja, editada', ...old.slice(1)].join('\n') + '\n');
    assert.deepEqual(
      findLongBlocks({ cwd: repo, base: 'main' }).map(({ file, start }) => `${file}:${start}`),
      ['new.ts:1', 'old.ts:1'],
    );
  });
});

// B17: la regla vale para todo el repositorio, no solo para lo que toca una rama.
describe('the repository itself', () => {
  it('has no comment block over three lines anywhere', () => {
    assert.deepEqual(
      findLongBlocks().map(({ file, start }) => `${file}:${start}`),
      [],
    );
  });

  it('is what CI checks: the step runs over everything, with no --base', () => {
    const workflow = readFileSync(
      new URL('../../.github/workflows/ci.yml', import.meta.url),
      'utf8',
    );
    const step = /- name: Comments \(three lines per block\)\n([\s\S]*?)\n\s*\n/.exec(workflow);
    assert.ok(step, 'the Comments step is missing from ci.yml');
    assert.match(step[1], /run: npm run lint:comments$/m);
  });
});
