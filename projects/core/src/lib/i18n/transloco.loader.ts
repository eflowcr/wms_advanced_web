import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import type { Observable } from 'rxjs';

/**
 * Diccionarios desde public/i18n del shell, mismo origen, que `connect-src 'self'` permite.
 * 'es' o 'scope/es' mapean a public/i18n/es.json o <scope>/es.json. URL relativa a <base href>.
 */
@Injectable()
export class HttpTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(path: string): Observable<Translation> {
    return this.http.get<Translation>(`i18n/${path}.json`);
  }
}
