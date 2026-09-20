/**
 * Reading a design token from TypeScript.
 *
 * ALMOST NOTHING IN THIS LIBRARY NEEDS THIS, AND THAT IS THE POINT. A colour,
 * a radius or a shadow is consumed as a utility or as `var(--name)` and never
 * reaches TypeScript at all. A handful of values cannot take that route --
 * they are arguments to `setTimeout`, not declarations -- and for those the
 * choice is between reading the token at runtime and copying its value into
 * the code. A copy is exactly the drift gate 10 exists to prevent, so the
 * token is read.
 *
 * WHEN THE TOKEN IS NOT THERE, THIS RETURNS NULL AND THE CALLER DECIDES.
 *
 * No fallback constant lives here. A fallback is a second copy of the value
 * wearing a disguise: it is right until tokens.css moves, and then it is a
 * silent second source of truth. `null` forces the caller to have an answer
 * for "the stylesheet is not loaded" that does not involve a number, which in
 * the Toast's case is "the message stays until it is dismissed".
 *
 * The read is against `document.documentElement` because that is where
 * tokens.css declares `:root`. It is not cached: a token can be redefined by
 * a theme at any time, and the calls are rare by construction.
 */

/**
 * A CSS time token as a number of milliseconds, or `null` when the property
 * is not declared or does not parse.
 *
 * Both CSS time units are accepted, because both are legal in the property
 * and a token written as `3s` means exactly what `3000ms` means.
 */
export function readMilliseconds(token: string): number | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!raw) {
    return null;
  }
  const match = /^(-?\d*\.?\d+)(ms|s)$/.exec(raw);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return match[2] === 's' ? value * 1000 : value;
}

/**
 * A CSS length token as a number of pixels, or `null` when it is not declared
 * or is not in pixels.
 *
 * Same contract as `readMilliseconds`, and the same reason: virtualisation
 * needs the row height as a NUMBER, because that is what the CDK's viewport
 * takes. Everything else about a row height is a declaration and never reaches
 * TypeScript at all.
 *
 * Only `px` is accepted. A row height in `rem` would be a row height that
 * changes with the browser's font size, which is a legitimate thing to want
 * and is not what this system does -- and silently multiplying by 16 to
 * pretend otherwise is how a virtualised list ends up half a screen out.
 */
export function readPixels(token: string): number | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const match = /^(\d*\.?\d+)px$/.exec(raw);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
