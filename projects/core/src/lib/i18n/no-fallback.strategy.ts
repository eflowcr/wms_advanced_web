import { Injectable } from '@angular/core';
import type { TranslocoFallbackStrategy } from '@jsverse/transloco';

/**
 * Apaga el fallback de Transloco, que escondía el fallo: cargar `en` podía devolver el
 * diccionario español como éxito. Qué hacer si un diccionario no carga lo decide LanguageService.
 */
@Injectable()
export class NoFallbackStrategy implements TranslocoFallbackStrategy {
  getNextLangs(): string[] {
    return [];
  }
}
