/** Lo que anuncia o flota por su cuenta sigue vivo bajo un modal: regiones vivas y capas del CDK. */
const LIVE = '[aria-live],[role=status],[role=alert],[role=log],.cdk-overlay-container';

/**
 * Vuelve modal a `dialog`: su rol y su nombre, e `inert` en lo que tapa su velo, salvo lo vivo y lo
 * que se pinta sobre el velo (capa mayor, como la cabecera del marco). Devuelve cómo deshacerlo.
 */
export function makeModal(dialog: Element, veil: Element, label: string): () => void {
  const layer = (element: Element): number => +getComputedStyle(element).zIndex || 0;
  const veilLayer = layer(veil);
  const made: Element[] = [];
  const walk = (parent: Element): void => {
    for (const child of parent.children) {
      if (
        child === dialog ||
        child === veil ||
        child.matches(LIVE) ||
        child.hasAttribute('inert') ||
        layer(child) > veilLayer
      ) {
        continue;
      }
      if (child.contains(dialog) || child.contains(veil) || child.querySelector(LIVE)) {
        walk(child);
      } else {
        made.push(child);
      }
    }
  };
  walk(dialog.ownerDocument.body);
  for (const element of made) element.setAttribute('inert', '');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', label);
  return () => {
    for (const element of made) element.removeAttribute('inert');
    for (const name of ['role', 'aria-modal', 'aria-label']) dialog.removeAttribute(name);
  };
}
