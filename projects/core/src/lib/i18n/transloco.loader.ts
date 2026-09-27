import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import type { Observable } from 'rxjs';

/** Huella de cada diccionario (`'es'`, `'showroom/es'`); la genera el shell (ADR 0018). */
export const DICTIONARY_VERSIONS = new InjectionToken<Readonly<Record<string, string>>>(
  'DICTIONARY_VERSIONS',
  { providedIn: 'root', factory: () => ({}) },
);

/**
 * Diccionarios desde public/i18n del shell, mismo origen, que `connect-src 'self'` permite.
 * 'es' o 'scope/es' mapean a public/i18n/es.json o <scope>/es.json, con `?v=<huella>` si la hay.
 */
@Injectable()
export class HttpTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);
  private readonly versions = inject(DICTIONARY_VERSIONS);

  getTranslation(path: string): Observable<Translation> {
    const version = this.versions[path];
    return this.http.get<Translation>(`i18n/${path}.json${version ? `?v=${version}` : ''}`);
  }
}
