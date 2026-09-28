import type { HttpInterceptorFn } from '@angular/common/http';

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

/** Cada petición sale con su traza, salvo que ya traiga una. */
export const traceparentInterceptor: HttpInterceptorFn = (request, next) =>
  next(
    request.headers.has(TRACEPARENT)
      ? request
      : request.clone({ setHeaders: { [TRACEPARENT]: newTraceparent() } }),
  );
