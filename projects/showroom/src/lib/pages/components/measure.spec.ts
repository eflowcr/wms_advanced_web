import {
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
 * Prueba la rama «nada que medir», que en una página bien renderizada nunca corre.
 * jsdom no maqueta (todo mide cero): acá se prueba formatear y comparar; que el
 * rectángulo sea el correcto lo afirma e2e/showroom.e2e.ts.
 */
function withElement<T>(
  build: (root: HTMLElement) => void,
  use: (root: HTMLElement) => T,
): T {
  // Nodo a nodo: innerHTML está prohibido en todo el repositorio, pruebas incluidas.
  const root = document.createElement('div');
  build(root);
  document.body.appendChild(root);
  try {
    return use(root);
  } finally {
    root.remove();
  }
}

/** Agrega un elemento a la raíz de prueba, con un hijo opcional. */
function append(root: HTMLElement, tag: string, child?: string): HTMLElement {
  const element = document.createElement(tag);
  if (child) {
    element.appendChild(document.createElement(child));
  }
  root.appendChild(element);
  return element;
}

/** Rectángulo que jsdom no produce, para que las cuentas tengan con qué trabajar. */
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
    // Sin longitud literal: la compuerta 10 lee toda cadena de un .ts como posible
    // valor crudo, y a esta función le da igual qué contiene.
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
