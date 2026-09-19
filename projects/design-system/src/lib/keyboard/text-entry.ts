/**
 * IS THE PERSON TYPING INTO SOMETHING RIGHT NOW? (REQ-FE-DS4-001 RFE-04.)
 *
 * This is the rule that gets broken by accident more than any other, and the
 * failure is silent: somebody types a supplier's name with an `n` in it and a
 * blank creation form opens over their work. So the question is answered
 * against the REAL target rather than against `event.target`, and the answer
 * defaults to "yes" whenever it cannot tell.
 */

/**
 * `<input type="...">` values that are NOT text entry.
 *
 * A DENY-LIST AND NOT AN ALLOW-LIST, and the direction is the whole point: a
 * type this file has never heard of -- a new one, a vendor one, a typo -- is
 * treated as text entry, so the shortcut does not fire. The wrong answer costs
 * a person one press of a key they can repeat; the other wrong answer costs a
 * form opening in the middle of a code being typed.
 */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * Whether the focus is somewhere a keystroke becomes text.
 *
 * `composedPath()[0]` and not `event.target`: an event that crosses a shadow
 * boundary is RETARGETED, so `target` reports the host element and an input
 * inside a shadow root looks like a `<div>` from out here. Nothing in this
 * system uses shadow DOM today -- Angular's default encapsulation does not --
 * but a component that did would silently lose this protection, and a
 * protection that fails silently when somebody makes an ordinary choice is not
 * a protection.
 */
export function isTextEntry(event: KeyboardEvent): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const target = (path[0] ?? event.target) as EventTarget | null;
  if (!isElement(target)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  if (tag === 'TEXTAREA') {
    return true;
  }
  if (tag === 'INPUT') {
    const type = target.getAttribute('type')?.toLowerCase() ?? 'text';
    return !NON_TEXT_INPUT_TYPES.has(type);
  }

  /*
   * A combo box that is not an <input> still swallows typing: `role="textbox"`
   * and `role="searchbox"` are the ARIA names for exactly this, and an
   * element that claims one is claiming to be a field whatever its tag says.
   */
  const role = target.getAttribute('role');
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}

/**
 * A narrowing that survives a target from another document or a detached node.
 *
 * `instanceof HTMLElement` is false across realms -- an iframe's element is an
 * instance of ITS window's HTMLElement, not ours -- and this runs against
 * whatever the document hands over.
 */
function isElement(target: EventTarget | null): target is HTMLElement {
  return (
    target !== null &&
    typeof target === 'object' &&
    'tagName' in target &&
    typeof (target as HTMLElement).tagName === 'string'
  );
}
