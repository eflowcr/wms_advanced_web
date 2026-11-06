import assert from 'node:assert/strict';
import { test } from 'node:test';
import { securityHeaders } from './headers.mjs';
import { nginxHeaders } from './nginx-headers.mjs';

test('nginx gets every contract header, always, with the CSP of the meta', () => {
  const conf = nginxHeaders();
  const expected = securityHeaders();
  assert.equal(conf.trim().split('\n').length, Object.keys(expected).length);
  for (const value of Object.values(expected)) {
    assert.ok(conf.includes(`"${value}" always;`), `missing ${value}`);
  }
  assert.match(conf, /^add_header Content-Security-Policy "default-src 'self';.*frame-ancestors 'none'" always;$/m);
});

test('a header with a double quote would break nginx and is refused', () => {
  assert.throws(() => nginxHeaders({ 'x-test': 'a"b' }), /double quote/);
});
