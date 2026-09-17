import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import type { Observable } from 'rxjs';

/**
 * Loads dictionaries from the shell's public/ folder, same origin, so the CSP
 * (`connect-src 'self'`) already allows it.
 *
 * Transloco passes 'es' for the root dictionary and 'scope/es' for a scope,
 * which maps straight onto the folder convention:
 *
 *   public/i18n/es.json
 *   public/i18n/<scope>/es.json
 *
 * Relative URL on purpose: it resolves against <base href>.
 */
@Injectable()
export class HttpTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(path: string): Observable<Translation> {
    return this.http.get<Translation>(`i18n/${path}.json`);
  }
}
