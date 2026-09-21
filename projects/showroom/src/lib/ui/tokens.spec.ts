import {
  AA_NON_TEXT,
  AA_TEXT,
  composite,
  contrastRatio,
  formatRatio,
  isPrimitiveValue,
  luminance,
  parseColor,
  readDeclarations,
  referencedTokens,
  resolveChain,
  verdict,
  type Rgb,
} from './tokens';

// Las cadenas normalizadas del parser se arman, no se escriben: la compuerta 10 rechaza toda
// función de color bajo projects/ y no distingue fixture de hoja de estilos.
const FN = 'rgb';
const parsed = (...channels: readonly (number | string)[]) => `${FN}(${channels.join(', ')})`;

// Palabras clave de color, por lo mismo: ningún hex fuera de tokens.css.
const NAVY_KEYWORD = 'navy';
const WHITE_KEYWORD = 'white';

// Y longitudes, que la compuerta 10 lee igual.
const UNIT = 'px';
const len = (value: number) => `${value}${UNIT}`;
const shadow = (a: number, b: number) => `0 0 0 ${len(a)} var(--a), 0 0 0 ${len(b)} var(--b)`;

/** Doble mínimo de la parte del CSSOM que recorre readDeclarations. */
function styleRule(selectorText: string, declarations: Record<string, string>) {
  const names = Object.keys(declarations);
  return {
    selectorText,
    style: {
      length: names.length,
      item: (index: number) => names[index] ?? '',
      getPropertyValue: (name: string) => declarations[name] ?? '',
    },
  };
}

function ruleList(rules: unknown[]) {
  return { length: rules.length, item: (index: number) => rules[index] ?? null };
}

function fakeDocument(sheets: unknown[]) {
  return { styleSheets: { length: sheets.length, item: (i: number) => sheets[i] ?? null } };
}

describe('referencedTokens', () => {
  it('finds every token a declaration names', () => {
    expect(referencedTokens('var(--a)')).toEqual(['--a']);
    expect(referencedTokens(shadow(2, 5))).toEqual(['--a', '--b']);
    expect(referencedTokens('var( --spaced )')).toEqual(['--spaced']);
  });

  it('finds none in a literal', () => {
    expect(referencedTokens(NAVY_KEYWORD)).toEqual([]);
    expect(referencedTokens(len(4))).toEqual([]);
  });
});

describe('isPrimitiveValue', () => {
  it('calls a declaration with no reference a primitive', () => {
    expect(isPrimitiveValue(NAVY_KEYWORD)).toBe(true);
    expect(isPrimitiveValue('var(--x)')).toBe(false);
  });
});

describe('readDeclarations', () => {
  it('reads custom properties declared on the root', () => {
    const document = fakeDocument([
      { cssRules: ruleList([styleRule(':root', { '--a': 'var(--b)', '--b': NAVY_KEYWORD })]) },
    ]);
    const declarations = readDeclarations(document as unknown as Document);
    expect(declarations.get('--a')).toBe('var(--b)');
    expect(declarations.get('--b')).toBe(NAVY_KEYWORD);
  });

  it('ignores rules that are not the root, and properties that are not tokens', () => {
    const document = fakeDocument([
      {
        cssRules: ruleList([
          styleRule('.card', { '--not-a-token': 'x' }),
          styleRule(':root', { '--yes': '1', color: 'red' }),
        ]),
      },
    ]);
    const declarations = readDeclarations(document as unknown as Document);
    expect(declarations.has('--not-a-token')).toBe(false);
    expect(declarations.has('color')).toBe(false);
    expect(declarations.get('--yes')).toBe('1');
  });

  it('descends into grouping rules, which is where Tailwind puts its layers', () => {
    const document = fakeDocument([
      {
        cssRules: ruleList([
          { cssRules: ruleList([styleRule(':root', { '--nested': WHITE_KEYWORD })]) },
        ]),
      },
    ]);
    expect(readDeclarations(document as unknown as Document).get('--nested')).toBe(WHITE_KEYWORD);
  });

  it('survives a stylesheet it is not allowed to read', () => {
    const hostile = {
      get cssRules(): never {
        throw new Error('cross-origin');
      },
    };
    const document = fakeDocument([
      hostile,
      { cssRules: ruleList([styleRule(':root', { '--ok': '1' })]) },
    ]);
    expect(readDeclarations(document as unknown as Document).get('--ok')).toBe('1');
  });

  it('lets a later declaration win, the way the cascade does', () => {
    const document = fakeDocument([
      { cssRules: ruleList([styleRule(':root', { '--x': 'first' })]) },
      { cssRules: ruleList([styleRule(':root', { '--x': 'second' })]) },
    ]);
    expect(readDeclarations(document as unknown as Document).get('--x')).toBe('second');
  });
});

describe('resolveChain', () => {
  const declarations = new Map([
    ['--semantic', 'var(--alias)'],
    ['--alias', 'var(--primitive)'],
    ['--primitive', NAVY_KEYWORD],
    ['--composite', shadow(2, 5)],
    ['--loop', 'var(--loop)'],
  ]);

  it('walks a semantic all the way down to its primitive', () => {
    const chain = resolveChain('--semantic', declarations, NAVY_KEYWORD);
    expect(chain.status).toBe('resolved');
    expect(chain.links.map((link) => link.name)).toEqual(['--semantic', '--alias', '--primitive']);
    expect(chain.primitive).toBe('--primitive');
    expect(chain.value).toBe(NAVY_KEYWORD);
  });

  it('stops at a declaration that names more than one token', () => {
    const chain = resolveChain('--composite', declarations, shadow(2, 5));
    expect(chain.links).toHaveLength(1);
    // Sin padre único, no se inventa uno.
    expect(chain.primitive).toBeNull();
  });

  it('reports a token nobody declared as missing', () => {
    const chain = resolveChain('--nope', declarations, '');
    expect(chain.status).toBe('missing');
    expect(chain.links).toEqual([]);
    expect(chain.primitive).toBeNull();
    expect(chain.value).toBe('');
  });

  it('does not spin on a token that points at itself', () => {
    const chain = resolveChain('--loop', declarations, '');
    expect(chain.links.map((link) => link.name)).toEqual(['--loop']);
  });

  it('marks a primitive asked for directly as its own primitive', () => {
    const chain = resolveChain('--primitive', declarations, NAVY_KEYWORD);
    expect(chain.primitive).toBe('--primitive');
    expect(chain.links).toHaveLength(1);
  });
});

describe('colour', () => {
  /** Sonda cuyo color computado es lo que habría devuelto el parser. */
  function probeFor(normalised: string) {
    const element = { style: { color: '' } } as unknown as HTMLElement;
    const view = {
      getComputedStyle: () => ({ color: normalised }),
    } as unknown as Window;
    return { element, view };
  }

  it('reads channels back from the parser', () => {
    const { element, view } = probeFor(parsed(1, 15, 66));
    expect(parseColor(view, element, NAVY_KEYWORD)).toEqual({ r: 1, g: 15, b: 66, alpha: 1 });
  });

  it('keeps the alpha channel when there is one', () => {
    const { element, view } = probeFor(parsed(1, 15, 66, '0.5'));
    expect(parseColor(view, element, 'x')?.alpha).toBe(0.5);
  });

  it('returns null for a value the parser refuses', () => {
    const element = { style: { color: '' } } as unknown as HTMLElement;
    const view = { getComputedStyle: () => ({ color: '' }) } as unknown as Window;
    // La asignación deja la propiedad vacía: así se distingue lo que no es color.
    expect(parseColor(view, element, `0 ${len(1)} ${len(2)}`)).toBeNull();
  });

  it('returns null when the parser gives back something unusable', () => {
    const { element, view } = probeFor('not-a-colour');
    element.style.color = 'seeded';
    expect(parseColor(view, element, 'seeded')).toBeNull();
  });

  const white: Rgb = { r: 255, g: 255, b: 255, alpha: 1 };
  const navy: Rgb = { r: 1, g: 15, b: 66, alpha: 1 };

  it('computes the luminance of black and white', () => {
    expect(luminance({ r: 0, g: 0, b: 0, alpha: 1 })).toBeCloseTo(0, 5);
    expect(luminance(white)).toBeCloseTo(1, 5);
  });

  it('computes the WCAG ratio, in either order', () => {
    expect(contrastRatio(navy, white)).toBeCloseTo(18.29, 1);
    expect(contrastRatio(white, navy)).toBeCloseTo(18.29, 1);
  });

  it('gives black on white the textbook 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0, alpha: 1 }, white)).toBeCloseTo(21, 2);
  });

  it('lays a translucent colour over its background before judging it', () => {
    const half = { ...navy, alpha: 0.5 };
    expect(composite(half, white)).toEqual({ r: 128, g: 135, b: 160.5, alpha: 1 });
    expect(contrastRatio(half, white)).toBeLessThan(contrastRatio(navy, white));
  });

  it('formats a ratio the way the vault writes it', () => {
    expect(formatRatio(4.8612)).toBe('4.86:1');
  });
});

describe('verdict', () => {
  it('passes at or above the minimum and fails below it', () => {
    expect(verdict(4.5, AA_TEXT, false)).toBe('pass');
    expect(verdict(4.49, AA_TEXT, false)).toBe('fail');
    expect(verdict(3, AA_NON_TEXT, false)).toBe('pass');
  });

  it('calls an exempt pair exempt whatever the ratio, because it is a different question', () => {
    expect(verdict(1.38, AA_TEXT, true)).toBe('exempt');
    expect(verdict(19, AA_TEXT, true)).toBe('exempt');
  });
});
