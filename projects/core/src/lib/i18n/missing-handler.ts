import { Injectable, isDevMode } from '@angular/core';
import type { TranslocoMissingHandler, TranslocoMissingHandlerData } from '@jsverse/transloco';

/**
 * What a missing key does.
 *
 * - Development (ng serve, unit tests, e2e): throws, so it shows up in the
 *   test that renders it and not in front of a user.
 * - Production: returns the key path (`inventory.title`), never an empty
 *   string. Odd text on screen is a visible bug; a blank is an invisible one.
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
