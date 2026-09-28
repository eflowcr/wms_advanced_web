import { DOCUMENT } from '@angular/common';
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

/** Cabecera de W3C Trace Context. El nombre y el formato final se acuerdan con backend (AUD-003/004). */
export const TRACEPARENT = 'traceparent';

/** Bytes al azar; las specs lo reemplazan para fijar el resultado. */
export type RandomBytes = (length: number) => Uint8Array;

const cryptoBytes: RandomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));

const hex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

/** Identificador no nulo: W3C declara inválido uno de puros ceros. */
function nonZero(random: RandomBytes, length: number): string {
  for (;;) {
    const id = hex(random(length));
    if (/[^0]/.test(id)) {
      return id;
    }
  }
}

/**
 * `00-<traza 16 bytes>-<padre 8 bytes>-00`: versión 00; bandera 00 porque el navegador no graba
 * nada. Si backend debe muestrear lo que llega de la consola es **(pendiente)** en 05-API.
 */
export function newTraceparent(random: RandomBytes = cryptoBytes): string {
  return `00-${nonZero(random, 16)}-${nonZero(random, 8)}-00`;
}

/**
 * Cada petición al propio origen sale con su traza, salvo que ya traiga una. A otro origen, nunca:
 * la traza no es de un tercero y la cabecera le forzaría un preflight de CORS. Ver vault: Traza W3C.
 */
export const traceparentInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  const sameOrigin = new URL(request.url, document.baseURI).origin === document.location.origin;
  return next(
    !sameOrigin || request.headers.has(TRACEPARENT)
      ? request
      : request.clone({ setHeaders: { [TRACEPARENT]: newTraceparent() } }),
  );
};
