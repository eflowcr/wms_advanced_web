/**
 * Reading a rendered control's geometry, in one place.
 *
 * Every component sheet makes at least one measured claim -- 32 / 40 / 48,
 * 18x18, 44x24 with a thumb of 20, a chevron that stays at 16 -- and every one
 * of them reads that number off the rendered element instead of printing it.
 * That is the showroom's whole contribution over the vault: a number typed
 * into a page starts lying the moment a token moves; a number read off the
 * element cannot.
 *
 * WHY THIS IS A MODULE AND NOT SIX COPIES OF THE SAME FIVE LINES.
 *
 * Each of those reads has to answer the same awkward question -- what does the
 * page say when there is nothing to measure? -- and each page answering it on
 * its own meant six `if (!element)` arms, six em dashes, and six chances for
 * one of them to render the string `undefined` at a reader. Here it is decided
 * once, and `measure.spec.ts` exercises both the found and the missing case
 * against real elements, which is the only way that arm is ever executed.
 *
 * Everything below takes `DOMRect | null` rather than an element, so the
 * caller does the lookup and these stay pure.
 */

/** What the pages print where a number was expected and none arrived. */
export const NOT_MEASURED = '—';

/** The rectangle of the first match, or null when the page has no such element. */
export function rectOf(root: ParentNode, selector: string): DOMRect | null {
  return root.querySelector(selector)?.getBoundingClientRect() ?? null;
}

/** Rounded width, and zero when there was nothing to measure. */
export function widthOf(rect: DOMRect | null): number {
  return rect ? Math.round(rect.width) : 0;
}

/** Rounded height, and zero when there was nothing to measure. */
export function heightOf(rect: DOMRect | null): number {
  return rect ? Math.round(rect.height) : 0;
}

/** `40 × 40 px`, for a claim about a box. */
export function formatBox(rect: DOMRect | null): string {
  return rect ? `${widthOf(rect)} × ${heightOf(rect)} px` : NOT_MEASURED;
}

/** `40 px`, for a claim about a control height. */
export function formatHeight(rect: DOMRect | null): string {
  return rect ? `${heightOf(rect)} px` : NOT_MEASURED;
}

/**
 * Whether the box clears a square minimum in both directions -- WCAG 2.2
 * 2.5.8 (Target Size, Minimum, AA) asks 24 by 24.
 *
 * A missing rectangle is NOT a pass. Answering `true` for something that was
 * never on screen would turn the Icon Button's badge into a green box that
 * means "we could not check".
 */
export function clearsSquare(rect: DOMRect | null, minimum: number): boolean {
  return rect !== null && widthOf(rect) >= minimum && heightOf(rect) >= minimum;
}

/** Whether two controls ended up the same height, to the pixel. */
export function sameHeight(first: DOMRect | null, second: DOMRect | null): boolean {
  return first !== null && second !== null && heightOf(first) === heightOf(second);
}

/** Whether the box is exactly this wide and this tall. */
export function isExactly(rect: DOMRect | null, width: number, height: number): boolean {
  return rect !== null && widthOf(rect) === width && heightOf(rect) === height;
}

/** A value read off the DOM, or the em dash when the read came back empty. */
export function orNotMeasured(value: string | null | undefined): string {
  return value ? value : NOT_MEASURED;
}

/** `<h3>`, the element a component really produced. */
export function tagOf(element: Element | null): string {
  return element ? `<${element.tagName.toLowerCase()}>` : NOT_MEASURED;
}

/** A computed property of an element, or the em dash when there is no element. */
export function computedOf(element: Element | null, property: string): string {
  return element
    ? orNotMeasured(getComputedStyle(element).getPropertyValue(property).trim())
    : NOT_MEASURED;
}
