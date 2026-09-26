import { TestBed } from '@angular/core/testing';
import { TokenReader } from './token-reader';

// Nombres de token inventados a propósito: la compuerta 10 rechaza un primitivo fuera de
// tokens.css, y así se prueba el recorrido y no el contenido actual de una rampa.

/*
 * Se usa una hoja real inyectada: jsdom arma CSSOM para un <style>. No sustituye `var()` en
 * propiedades computadas, así que el valor final queda vacío y la cadena no: justo la separación
 * del diseño (cadena desde declaraciones, valor final del estilo computado).
 */
describe('TokenReader', () => {
  let style: HTMLStyleElement;

  function reader(): TokenReader {
    return TestBed.inject(TokenReader);
  }

  // Armado y no escrito: la compuerta 10 lee una longitud en un fixture igual que en una hoja.
  const UNIT = 'px';
  const SHADOW = `0 0 0 2${UNIT} var(--color-surface), 0 0 0 5${UNIT} var(--accent-48)`;

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent = `
      :root {
        --tone-7: navy;
        --tone-100: white;
        --tone-7-a06: teal;
        --accent-48: blue;
        --color-text-primary: var(--tone-7);
        --color-surface: var(--tone-100);
        --focus-ring-shadow: ${SHADOW};
      }
      .not-root { --color-ignored: black; }
    `;
    document.head.appendChild(style);
    TestBed.configureTestingModule({});
  });

  afterEach(() => style.remove());

  it('walks a semantic down to its primitive', () => {
    const chain = reader().chain('--color-text-primary');
    expect(chain.status).toBe('resolved');
    expect(chain.links.map((link) => link.name)).toEqual(['--color-text-primary', '--tone-7']);
    expect(chain.primitive).toBe('--tone-7');
  });

  it('reports a token that does not exist as missing', () => {
    expect(reader().chain('--color-does-not-exist').status).toBe('missing');
  });

  it('stops at a declaration naming more than one token', () => {
    const chain = reader().chain('--focus-ring-shadow');
    expect(chain.links).toHaveLength(1);
    expect(chain.primitive).toBeNull();
  });

  it('never picks up a declaration from a rule that is not the root', () => {
    expect(reader().chain('--color-ignored').status).toBe('missing');
  });

  it('lists the primitives, which is every declaration with no reference in it', () => {
    const primitives = reader().primitiveNames();
    expect(primitives).toContain('--tone-7');
    expect(primitives).toContain('--accent-48');
    expect(primitives).not.toContain('--color-text-primary');
  });

  it('groups the tone ramps by family and keeps the translucent ones out', () => {
    const [tone, accent] = reader().toneFamilies(['tone', 'accent']);
    expect(tone?.names).toEqual(['--tone-7', '--tone-100']);
    expect(tone?.names).not.toContain('--tone-7-a06');
    expect(accent?.names).toEqual(['--accent-48']);
  });

  it('lists the translucent primitives separately', () => {
    expect(reader().alphaPrimitives('tone')).toEqual(['--tone-7-a06']);
    expect(reader().alphaPrimitives('accent')).toEqual([]);
  });

  it('parses a colour through the document', () => {
    expect(reader().colour('navy')).not.toBeNull();
  });

  it('returns nothing for an empty value rather than guessing', () => {
    expect(reader().colour('')).toBeNull();
  });

  it('gives no ratio when either side is not a colour', () => {
    expect(reader().ratio('--focus-ring-shadow', '--color-surface')).toBeNull();
  });

  it('reuses one probe instead of littering the document', () => {
    const before = document.body.childElementCount;
    const instance = reader();
    instance.colour('navy');
    instance.colour('white');
    expect(document.body.childElementCount).toBe(before + 1);
  });
});
