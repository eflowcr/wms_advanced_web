import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { type Assignment, SecurityError, type SecurityRequest } from './access';
import { parseProblemError } from './http-security-gateway';
import { SECURITY_API_URL } from './security-api-url';

/**
 * Puerto de la administración que solo usan las pantallas de Seguridad. Separado de
 * SecurityGateway para cargarse con ellas, no al arrancar. Ver vault: Seguridad y usuarios.
 */
@Injectable({ providedIn: 'root', useFactory: () => inject(HttpSecurityAdministration) })
export abstract class SecurityAdministration {
  /** Alta masiva: agrega filas explícitas de una vez, todas o ninguna. */
  abstract addAssignments(
    request: SecurityRequest,
    assignments: readonly Assignment[],
    version: number,
  ): Promise<void>;
}

/** Adaptador sobre el contrato HTTP propuesto; como el gateway, no afirma identidad. */
@Injectable({ providedIn: 'root' })
export class HttpSecurityAdministration extends SecurityAdministration {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);

  async addAssignments(
    request: SecurityRequest,
    assignments: readonly Assignment[],
    version: number,
  ): Promise<void> {
    const { signal } = request;
    if (signal.aborted) throw new SecurityError('aborted');
    const base = this.baseUrl();
    if (!base) throw new SecurityError('unavailable');
    try {
      await firstValueFrom(
        this.http
          .post<void>(`${base}/assignments`, { assignments, version })
          .pipe(takeUntil(fromEvent(signal, 'abort'))),
      );
    } catch (err) {
      throw parseProblemError(err, signal);
    }
  }
}
