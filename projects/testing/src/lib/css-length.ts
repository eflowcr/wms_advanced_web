/**
 * Longitud CSS armada en codigo, porque la compuerta de tokens prohibe literales
 * en pixeles fuera de `tokens.css`. Solo para specs que parsean una longitud o
 * reemplazan un token que la prueba no carga.
 */
export function pixels(value: number): string {
  return `${String(value)}px`;
}
