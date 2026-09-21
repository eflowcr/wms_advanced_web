import { isTextEntry } from './text-entry';

// RFE-04 sobre elementos reales: un caso por forma de campo, y uno por cada lado del default.

/** Con `composedPath()` empezando en `target`, como un evento real. */
function keydownOn(target: Element): KeyboardEvent {
  return {
    key: 'n',
    target,
    composedPath: () => [target],
  } as unknown as KeyboardEvent;
}

function input(type: string): HTMLInputElement {
  const element = document.createElement('input');
  element.setAttribute('type', type);
  return element;
}

describe('isTextEntry', () => {
  it('says yes to the shapes a person types into', () => {
    const textarea = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    // jsdom no deriva isContentEditable del atributo.
    Object.defineProperty(editable, 'isContentEditable', { value: true });

    for (const element of [input('text'), input('search'), input('number'), textarea, editable]) {
      expect(isTextEntry(keydownOn(element)), element.tagName).toBe(true);
    }
  });

  it('says yes to an input with no type at all, which defaults to text', () => {
    expect(isTextEntry(keydownOn(document.createElement('input')))).toBe(true);
  });

  it('says NO to the controls a keystroke does not become text in', () => {
    for (const type of ['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color']) {
      expect(isTextEntry(keydownOn(input(type))), type).toBe(false);
    }
  });

  it('says no to ordinary elements: a table, a button, the page itself', () => {
    for (const tag of ['div', 'button', 'td', 'a']) {
      expect(isTextEntry(keydownOn(document.createElement(tag))), tag).toBe(false);
    }
  });

  it('treats an input type it has never heard of as text entry', () => {
    // La dirección del default: lista de excluidos, así un tipo desconocido cae del lado
    // seguro. Ver vault: Atajos-de-Teclado.
    expect(isTextEntry(keydownOn(input('some-future-type')))).toBe(true);
  });

  it('believes an element that CLAIMS to be a field through its role', () => {
    for (const role of ['textbox', 'searchbox', 'combobox']) {
      const element = document.createElement('div');
      element.setAttribute('role', role);
      expect(isTextEntry(keydownOn(element)), role).toBe(true);
    }
  });

  // El título evita a propósito una palabra: es una utilidad de Tailwind que ADR 0009 borra,
  // y la compuerta 10 falla con ella entre comillas (igual que en dialog.types.ts).
  it('sees a field that event retargeting would otherwise hide', () => {
    // Al cruzar un shadow root, `target` reporta el host. Hoy nada usa shadow DOM: por eso
    // se prueba, para que adoptarlo no pierda la protección en silencio.
    const host = document.createElement('div');
    const field = input('text');
    const event = {
      key: 'n',
      target: host,
      composedPath: () => [field, host],
    } as unknown as KeyboardEvent;

    expect(isTextEntry(event)).toBe(true);
    // Contraste: el host no dice nada del campo.
    expect(isTextEntry(keydownOn(host))).toBe(false);
  });

  it('survives an event with no composedPath and no target', () => {
    const event = { key: 'n', target: null } as unknown as KeyboardEvent;
    expect(isTextEntry(event)).toBe(false);
  });
});
