import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, fromEvent } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  type AccessResult,
  type Actor,
  type Grants,
  type SecurityGateway,
  type SecuritySnapshot,
  type SecurityUser,
  SecurityError,
} from './access';
import { parseProblemError } from './problem-error';
import { SECURITY_API_URL } from './security-api-url';
import { ACCESS_QUERY } from './security-access.interceptor';

/** La API da los permisos efectivos sin su procedencia: todos se atribuyen a la sesión. */
export const SERVER_GRANT = 'server';

interface EffectivePermissionsBody {
  readonly permissions?: readonly string[] | null;
}

/**
 * SecurityGateway sobre la API Go del Security Core. Solo existe la lectura de permisos
 * efectivos; la administración (usuarios, perfiles, asignaciones) responde «no disponible».
 * Ver vault: Requerimientos de la API para el login.
 */
@Injectable({ providedIn: 'root' })
export class CoreSecurityGateway implements SecurityGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);
  private readonly accessQuery = new HttpContext().set(ACCESS_QUERY, true);

  async access(actor: Actor | null, signal: AbortSignal): Promise<AccessResult> {
    if (!actor) return { grants: {}, user: null };
    if (signal.aborted) throw new SecurityError('aborted');
    const base = this.baseUrl();
    if (!base) throw new SecurityError('unavailable');
    try {
      const body = await firstValueFrom(
        this.http
          .get<EffectivePermissionsBody>(`${base}/security/effective-permissions`, {
            context: this.accessQuery,
          })
          .pipe(takeUntil(fromEvent(signal, 'abort'))),
      );
      return { grants: toGrants(body?.permissions), user: null };
    } catch (err) {
      throw parseProblemError(err, signal);
    }
  }

  snapshot(): Promise<SecuritySnapshot> {
    return unavailable();
  }

  inspect(): Promise<Grants> {
    return unavailable();
  }

  users(): Promise<readonly SecurityUser[]> {
    return unavailable();
  }

  saveProfile(): Promise<void> {
    return unavailable();
  }

  setAssignments(): Promise<void> {
    return unavailable();
  }

  saveUser(): Promise<void> {
    return unavailable();
  }

  setUserStatus(): Promise<void> {
    return unavailable();
  }

  subscribe(): () => void {
    return () => undefined;
  }
}

export function toGrants(permissions: readonly string[] | null | undefined): Grants {
  const grants: Record<string, readonly string[]> = {};
  for (const code of permissions ?? []) if (typeof code === 'string') grants[code] = [SERVER_GRANT];
  return grants;
}

function unavailable(): Promise<never> {
  return Promise.reject(new SecurityError('unavailable'));
}
