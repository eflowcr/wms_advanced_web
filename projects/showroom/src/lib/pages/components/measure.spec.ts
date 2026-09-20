import {
  clearsSquare,
  computedOf,
  formatBox,
  formatHeight,
  heightOf,
  isExactly,
  NOT_MEASURED,
  orNotMeasured,
  rectOf,
  sameHeight,
  tagOf,
  widthOf,
} from './measure';

/**
 * The measuring helpers, including the arm nobody ever sees.
 *
 * WHY THIS FILE EXISTS. Every component sheet reads its numbers off the
 * rendered DOM, and every one of those reads has a "there was nothing to
 * measure" arm that, by construction, never runs on a page that rendered
 * correctly. Left inside each page it was six unreachable branches and six
 * chances to print the word `undefined` at a reader the one day a selector
 * went stale.
 *
 * Here it is one function per question, and the missing case is an ordinary
 * argument.
 *
 * jsdom lays nothing out, so every rectangle it produces is zero. That is fine
 * for what is under test: these functions are about FORMATTING and COMPARING a
 * rectangle, not about producing one. Whether the rectangle is the right one is
 * asserted in e2e/showroom.e2e.ts, in a browser.
 */
function withElement<T>(
  build: (root: HTMLElement) => void,
  use: (root: HTMLElement) => T,
): T {
  // Built node by node rather than from a string of markup: raw `innerHTML` is
  // banned repository-wide, tests included, and a test that needs an exception
  // to a security rule is a test that can be written differently.
  const root = document.createElement('div');
  build(root);
  document.body.appendChild(root);
  try {
    return use(root);
  } finally {
    root.remove();
  }
}

/** A `<tag>` inside the scratch root, optionally holding one child element. */
function append(root: HTMLElement, tag: string, child?: string): HTMLElement {
  const element = document.createElement(tag);
  if (child) {
    element.appendChild(document.createElement(child));
  }
  root.appendChild(element);
  return element;
}

/** A rectangle jsdom will not produce, so the maths has something to chew on. */
function rect(width: number, height: number): DOMRect {
  return { width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height } as DOMRect;
}

describe('rectOf', () => {
  it('returns the rectangle of the first match', () => {
    const found = withElement(
      (root) => append(root, 'span', 'button').setAttribute('data-x', ''),
      (root) => rectOf(root, '[data-x] button'),
    );
    expect(found).not.toBeNull();
  });

  it('returns null when the page has no such element', () => {
    const found = withElement(
      (root) => append(root, 'span'),
      (root) => rectOf(root, '[data-missing] button'),
    );
    expect(found).toBeNull();
  });
});

describe('widthOf / heightOf', () => {
  it('rounds what it was given', () => {
    expect(widthOf(rect(40.4, 32.6))).toBe(40);
    expect(heightOf(rect(40.4, 32.6))).toBe(33);
  });

  it('answers zero rather than NaN when there is nothing to measure', () => {
    expect(widthOf(null)).toBe(0);
    expect(heightOf(null)).toBe(0);
  });
});

describe('formatBox / formatHeight', () => {
  it('prints the box and the height a reader expects', () => {
    expect(formatBox(rect(44, 24))).toBe('44 × 24 px');
    expect(formatHeight(rect(120, 40))).toBe('40 px');
  });

  it('says so, visibly, when nothing was measured', () => {
    expect(formatBox(null)).toBe(NOT_MEASURED);
    expect(formatHeight(null)).toBe(NOT_MEASURED);
  });
});

describe('clearsSquare', () => {
  it('passes a box that clears the minimum in both directions', () => {
    expect(clearsSquare(rect(32, 32), 24)).toBe(true);
  });

  it('fails a box that is short in either direction', () => {
    expect(clearsSquare(rect(32, 20), 24)).toBe(false);
    expect(clearsSquare(rect(20, 32), 24)).toBe(false);
  });

  it('does NOT pass something that was never measured', () => {
    // A green badge that means "we could not check" is worse than no badge.
    expect(clearsSquare(null, 24)).toBe(false);
  });
});

describe('sameHeight', () => {
  it('compares to the pixel', () => {
    expect(sameHeight(rect(120, 40), rect(80, 40))).toBe(true);
    expect(sameHeight(rect(120, 40), rect(80, 32))).toBe(false);
  });

  it('is false when either one is missing', () => {
    expect(sameHeight(null, rect(80, 40))).toBe(false);
    expect(sameHeight(rect(80, 40), null)).toBe(false);
  });
});

describe('isExactly', () => {
  it('matches both dimensions or nothing', () => {
    expect(isExactly(rect(44, 24), 44, 24)).toBe(true);
    expect(isExactly(rect(44, 28), 44, 24)).toBe(false);
    expect(isExactly(rect(40, 24), 44, 24)).toBe(false);
    expect(isExactly(null, 44, 24)).toBe(false);
  });
});

describe('orNotMeasured', () => {
  it('keeps a real value and replaces an empty one', () => {
    // Not a length literal: gate 10 reads every string in a .ts file as a
    // possible raw value, and this function does not care what it is holding.
    expect(orNotMeasured('un valor')).toBe('un valor');
    expect(orNotMeasured('')).toBe(NOT_MEASURED);
    expect(orNotMeasured(null)).toBe(NOT_MEASURED);
    expect(orNotMeasured(undefined)).toBe(NOT_MEASURED);
  });
});

describe('tagOf', () => {
  it('names the element the component really produced', () => {
    const tag = withElement(
      (root) => append(root, 'h3'),
      (root) => tagOf(root.firstElementChild),
    );
    expect(tag).toBe('<h3>');
  });

  it('says so when there is no element', () => {
    expect(tagOf(null)).toBe(NOT_MEASURED);
  });
});

describe('computedOf', () => {
  it('reads a computed property off a real element', () => {
    const weight = '700';
    const value = withElement(
      (root) => {
        append(root, 'span').style.fontWeight = weight;
      },
      (root) => computedOf(root.firstElementChild, 'font-weight'),
    );
    expect(value).toBe(weight);
  });

  it('falls back when the property is not set, and when there is no element', () => {
    const empty = withElement(
      (root) => append(root, 'span'),
      (root) => computedOf(root.firstElementChild, '--not-declared-anywhere'),
    );
    expect(empty).toBe(NOT_MEASURED);
    expect(computedOf(null, 'font-size')).toBe(NOT_MEASURED);
  });
});
