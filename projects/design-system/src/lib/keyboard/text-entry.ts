// RFE-04: ¿la persona está tipeando? Se responde contra el destino real y, en la duda, «sí».

/** Excluidos, no permitidos: un tipo desconocido cuenta como texto. Ver vault: Atajos-de-Teclado. */
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

/** `composedPath()[0]`: tras un shadow root, `target` es el host. Ver vault: Atajos-de-Teclado. */
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

  // Un elemento con rol de campo de texto se traga lo tipeado aunque no sea `<input>`.
  const role = target.getAttribute('role');
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}

/** Sin `instanceof HTMLElement`, falso entre realms (un iframe trae su propio HTMLElement). */
function isElement(target: EventTarget | null): target is HTMLElement {
  return (
    target !== null &&
    typeof target === 'object' &&
    'tagName' in target &&
    typeof (target as HTMLElement).tagName === 'string'
  );
}
