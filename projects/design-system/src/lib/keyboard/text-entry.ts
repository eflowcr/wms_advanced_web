/**
 * ¿ESTÁ LA PERSONA TIPEANDO EN ALGO AHORA MISMO? (RFE-04.) Es la regla que más se
 * rompe por accidente y falla en silencio: alguien escribe el nombre de un
 * proveedor con una `n` y se le abre un formulario vacío encima del trabajo. Por
 * eso se responde contra el destino REAL, y por defecto se responde «sí».
 */

/**
 * Los `type` de `<input>` que NO son entrada de texto. UNA LISTA DE EXCLUIDOS Y NO
 * DE PERMITIDOS, y la dirección es el punto: un tipo que este archivo no conoce
 * -uno nuevo, uno de fabricante, un error de tipeo- cuenta como entrada de texto y
 * el atajo no dispara. La respuesta equivocada cuesta una tecla repetible; la otra
 * cuesta un formulario abriéndose en medio de un código.
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
 * Si el foco está donde una tecla se vuelve texto. `composedPath()[0]` y no
 * `event.target`: un evento que cruza un límite de shadow se REDIRIGE, así que
 * `target` reporta el host y un input dentro de un shadow root parece un `<div>`.
 * Hoy nada usa shadow DOM, pero una protección que falla en silencio cuando
 * alguien toma una decisión común no es una protección.
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
   * Un combo que no es `<input>` igual se traga lo tipeado: `role="textbox"` y
   * `role="searchbox"` son los nombres ARIA de exactamente eso, y un elemento que
   * reclama uno está diciendo que es un campo, diga lo que diga su etiqueta.
   */
  const role = target.getAttribute('role');
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}

/**
 * Un estrechamiento que sobrevive a un destino de otro documento o a un nodo
 * suelto. `instanceof HTMLElement` es falso entre realms -el elemento de un iframe
 * es instancia del HTMLElement de SU ventana, no de la nuestra- y esto corre contra
 * lo que sea que entregue el documento.
 */
function isElement(target: EventTarget | null): target is HTMLElement {
  return (
    target !== null &&
    typeof target === 'object' &&
    'tagName' in target &&
    typeof (target as HTMLElement).tagName === 'string'
  );
}
