/**
 * Leer un token de diseño desde TypeScript.
 *
 * CASI NADA DE ESTA LIBRERÍA LO NECESITA, Y ESE ES EL PUNTO: un color o un radio
 * se consume como utilidad o como `var(--nombre)` y nunca llega a TypeScript. Un
 * puñado de valores no puede -son argumentos de `setTimeout`, no declaraciones- y
 * ahí la opción es leer el token o copiar su valor al código; la copia es la
 * deriva que la compuerta 10 evita.
 * SIN EL TOKEN DEVUELVE NULL Y DECIDE QUIEN LLAMA. Acá no vive ningún valor de
 * reserva: uno sería una segunda copia disfrazada, correcta hasta que tokens.css
 * se mueva. La lectura va contra `document.documentElement` y no se cachea.
 */

/**
 * Un token de tiempo en milisegundos, o `null` si no está declarado o no parsea.
 * Se aceptan las dos unidades CSS: `3s` significa exactamente `3000ms`.
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
 * Un token de longitud en píxeles, o `null` si no está o no está en píxeles. Mismo
 * contrato que `readMilliseconds`: la virtualización necesita la altura de fila
 * como NÚMERO. Solo se acepta `px`: una altura en `rem` cambia con el tamaño de
 * fuente del navegador, y multiplicar por 16 en silencio es cómo una lista virtual
 * termina media pantalla corrida.
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
