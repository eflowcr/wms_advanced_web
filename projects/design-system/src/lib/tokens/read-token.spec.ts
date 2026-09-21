import { pixels } from '@ewms/testing';
import { readMilliseconds, readPixels } from './read-token';

// «Sin hoja de estilos» solo tiene comportamiento acá; se prueban los dos brazos porque en un
// navegador real corre uno solo.
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

// La altura de fila que la tabla virtual necesita como número; null en vez de adivinar cuarenta.
describe('readPixels', () => {
  const TOKEN = '--length-test';

  afterEach(() => {
    document.documentElement.style.removeProperty(TOKEN);
  });

  function declare(value: string): void {
    document.documentElement.style.setProperty(TOKEN, value);
  }

  it('reads a length in pixels', () => {
    declare(pixels(40));
    expect(readPixels(TOKEN)).toBe(40);
  });

  it('reads a fractional length', () => {
    declare(pixels(36.5));
    expect(readPixels(TOKEN)).toBe(36.5);
  });

  it('returns null when the token is not declared', () => {
    expect(readPixels(TOKEN)).toBeNull();
  });

  it('refuses rem rather than multiplying by sixteen', () => {
    // En rem, la altura sigue la fuente del navegador; fingir píxeles desfasa la lista virtual.
    declare('2.5rem');
    expect(readPixels(TOKEN)).toBeNull();
  });

  it('returns null for a unitless number and for zero', () => {
    declare('40');
    expect(readPixels(TOKEN)).toBeNull();
    declare(pixels(0));
    expect(readPixels(TOKEN)).toBeNull();
  });
});
