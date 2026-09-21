/**
 * Geometría de controles renderizados: cada ficha lee sus números del elemento, no
 * los escribe. Qué mostrar cuando no hay nada que medir se decide una vez acá
 * (lo prueba measure.spec.ts); todo recibe DOMRect | null para quedar puro.
 */

/** Lo que muestran las páginas cuando se esperaba un número y no llegó. */
export const NOT_MEASURED = '—';

/** Rectángulo de la primera coincidencia, o null si no existe el elemento. */
export function rectOf(root: ParentNode, selector: string): DOMRect | null {
  return root.querySelector(selector)?.getBoundingClientRect() ?? null;
}

/** Ancho redondeado; cero si no había nada que medir. */
export function widthOf(rect: DOMRect | null): number {
  return rect ? Math.round(rect.width) : 0;
}

/** Alto redondeado; cero si no había nada que medir. */
export function heightOf(rect: DOMRect | null): number {
  return rect ? Math.round(rect.height) : 0;
}

/** Formato «40 × 40 px», para afirmaciones sobre una caja. */
export function formatBox(rect: DOMRect | null): string {
  return rect ? `${widthOf(rect)} × ${heightOf(rect)} px` : NOT_MEASURED;
}

/** Formato «40 px», para la altura de un control. */
export function formatHeight(rect: DOMRect | null): string {
  return rect ? `${heightOf(rect)} px` : NOT_MEASURED;
}

/**
 * Mínimo cuadrado en ambos ejes; WCAG 2.2 2.5.8 (AA) pide 24 por 24. Sin rectángulo
 * no se aprueba: el badge en verde diría «no se pudo verificar».
 */
export function clearsSquare(rect: DOMRect | null, minimum: number): boolean {
  return rect !== null && widthOf(rect) >= minimum && heightOf(rect) >= minimum;
}

/** Si dos controles quedaron con la misma altura, al píxel. */
export function sameHeight(first: DOMRect | null, second: DOMRect | null): boolean {
  return first !== null && second !== null && heightOf(first) === heightOf(second);
}

/** Si la caja mide exactamente ese ancho y ese alto. */
export function isExactly(rect: DOMRect | null, width: number, height: number): boolean {
  return rect !== null && widthOf(rect) === width && heightOf(rect) === height;
}

/** Valor leído del DOM, o la raya si vino vacío. */
export function orNotMeasured(value: string | null | undefined): string {
  return value ? value : NOT_MEASURED;
}

/** El elemento que el componente produjo de verdad, con forma de etiqueta. */
export function tagOf(element: Element | null): string {
  return element ? `<${element.tagName.toLowerCase()}>` : NOT_MEASURED;
}

/** Propiedad computada del elemento, o la raya si no hay elemento. */
export function computedOf(element: Element | null, property: string): string {
  return element
    ? orNotMeasured(getComputedStyle(element).getPropertyValue(property).trim())
    : NOT_MEASURED;
}
