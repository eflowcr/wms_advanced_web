import { Injectable } from '@angular/core';
import type { TranslocoFallbackStrategy } from '@jsverse/transloco';

/**
 * Turns Transloco's automatic fallback off: a dictionary that fails to load
 * makes `TranslocoService.load()` error, and nothing else.
 *
 * Transloco's default strategy hides the failure. Depending on what is
 * already cached, loading `en` either completes with no value or resolves
 * with the Spanish dictionary, and the caller cannot tell it apart from a
 * success: the app would switch to `en` with no English text in memory.
 *
 * What to do when a dictionary does not load is a product decision, so it
 * lives in LanguageService, where it is written and tested (i18n.md, "Cuando
 * el diccionario no carga").
 */
@Injectable()
export class NoFallbackStrategy implements TranslocoFallbackStrategy {
  getNextLangs(): string[] {
    return [];
  }
}
