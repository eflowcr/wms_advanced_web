import { readMilliseconds } from './read-token';

/**
 * The only place in the library that reads a token from TypeScript, so the
 * only place where "the stylesheet is not there" is a case with a behaviour
 * rather than an impossibility. Both arms are exercised here because in a real
 * browser only one of them ever runs.
 */
describe('readMilliseconds', () => {
  const TOKEN = '--duration-test';

  afterEach(() => {
    document.documentElement.style.removeProperty(TOKEN);
  });

  function declare(value: string): void {
    document.documentElement.style.setProperty(TOKEN, value);
  }

  it('reads a value in milliseconds', () => {
    declare('3000ms');
    expect(readMilliseconds(TOKEN)).toBe(3000);
  });

  it('reads a value in seconds, because both units mean the same thing', () => {
    declare('2.5s');
    expect(readMilliseconds(TOKEN)).toBe(2500);
  });

  it('returns null when the token is not declared -- no fallback number', () => {
    expect(readMilliseconds(TOKEN)).toBeNull();
  });

  it('returns null for a value that is not a time', () => {
    declare('soon');
    expect(readMilliseconds(TOKEN)).toBeNull();
  });

  it('returns null for a unitless number: a bare 3000 is not a CSS time', () => {
    declare('3000');
    expect(readMilliseconds(TOKEN)).toBeNull();
  });

  it('returns null for a negative duration', () => {
    declare('-1s');
    expect(readMilliseconds(TOKEN)).toBeNull();
  });
});
