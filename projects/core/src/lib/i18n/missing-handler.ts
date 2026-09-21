import { Injectable, isDevMode } from '@angular/core';
import type { TranslocoMissingHandler, TranslocoMissingHandlerData } from '@jsverse/transloco';

/**
 * Clave faltante: en desarrollo lanza, para que aparezca en la prueba y no ante un usuario.
 * En producción devuelve la ruta de la clave, nunca vacío: un hueco es un bug que nadie ve.
 */
export function resolveMissingKey(key: string, lang: string, devMode: boolean): string {
  if (devMode) {
    throw new Error(
      `i18n: missing key '${key}' in '${lang}'. Add it to BOTH dictionaries ` +
        '(projects/shell/public/i18n) and run `npm run lint:i18n`.',
    );
  }
  return key;
}

@Injectable()
export class EwmsMissingHandler implements TranslocoMissingHandler {
  handle(key: string, data: TranslocoMissingHandlerData): string {
    return resolveMissingKey(key, data.activeLang, isDevMode());
  }
}
