/**
 * Solo para valores que TypeScript necesita como número (un `setTimeout`); copiarlos derivaría.
 * Sin el token devuelve null y decide quien llama: un valor de reserva sería una copia. Sin caché.
 */

/** Acepta `ms` y `s`; null si falta o no parsea. */
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

/** Solo píxeles: convertir `rem` en silencio desfasa una lista virtual si cambia la fuente. */
export function readPixels(token: string): number | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const match = /^(\d*\.?\d+)px$/.exec(raw);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
