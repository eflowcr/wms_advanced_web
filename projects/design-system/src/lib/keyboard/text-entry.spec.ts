import { isTextEntry } from './text-entry';

/**
 * RFE-04's question, asked of real elements.
 *
 * The rule that gets broken by accident more than any other: somebody types a
 * supplier's name with an `n` in it and a blank creation form opens over their
 * work. So every shape a field can take gets a case, and the two that decide
 * the DIRECTION of the default -- an unknown input type, and a field behind a
 * shadow boundary -- get one each.
 */

/** A keydown whose composed path starts at `target`, as a real event's does. */
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
    // jsdom does not derive isContentEditable from the attribute.
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
    /*
     * THE DIRECTION OF THE DEFAULT, ASSERTED. The list of non-text types is a
     * deny-list precisely so that a new type, a vendor type or a typo lands on
     * the safe side. Being wrong this way costs a person one press of a key
     * they can repeat; being wrong the other way opens a form in the middle of
     * a code being typed.
     */
    expect(isTextEntry(keydownOn(input('some-future-type')))).toBe(true);
  });

  it('believes an element that CLAIMS to be a field through its role', () => {
    for (const role of ['textbox', 'searchbox', 'combobox']) {
      const element = document.createElement('div');
      element.setAttribute('role', role);
      expect(isTextEntry(keydownOn(element)), role).toBe(true);
    }
  });

  /*
   * THE TITLE AVOIDS ONE PARTICULAR WORD ON PURPOSE, and cannot say which.
   *
   * Gate 10 reads every quoted run in a .ts file as a possible class name, and
   * the word for the boundary described below is also one of the Tailwind
   * default utilities ADR 0009 deletes -- so a test NAME containing it fails
   * the build. This note fails it too if it quotes the word to explain itself,
   * which is how the paragraph ended up phrased like this. The same recursion
   * is written up in dialog.types.ts, which met it first.
   */
  it('sees a field that event retargeting would otherwise hide', () => {
    /*
     * An event crossing a shadow boundary is RETARGETED: `target` reports the
     * HOST, so an input inside a shadow root looks like a plain element from
     * outside. Nothing in this system uses shadow DOM today, and that is
     * exactly why this is tested -- a component that started using it would
     * otherwise lose the protection silently.
     */
    const host = document.createElement('div');
    const field = input('text');
    const event = {
      key: 'n',
      target: host,
      composedPath: () => [field, host],
    } as unknown as KeyboardEvent;

    expect(isTextEntry(event)).toBe(true);
    // And the naive reading, for contrast: the host says nothing about the field.
    expect(isTextEntry(keydownOn(host))).toBe(false);
  });

  it('survives an event with no composedPath and no target', () => {
    const event = { key: 'n', target: null } as unknown as KeyboardEvent;
    expect(isTextEntry(event)).toBe(false);
  });
});
