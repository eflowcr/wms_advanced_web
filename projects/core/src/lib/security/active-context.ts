import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AccessContext } from './access';
import { AuthSession, type SessionGrant } from './auth-session';
import { SECURITY_API_URL } from './security-api-url';

/** Por qué el servidor no cambió el almacén activo; la pantalla lo traduce. */
export type ContextChangeCode = 'taskInProgress' | 'denied' | 'unavailable';
export class ContextChangeError extends Error {
  constructor(readonly code: ContextChangeCode) {
    super(code);
  }
}

/**
 * Puerto del almacén activo (SEC-MUL-003): la sesión del servidor es la única fuente y el cambio
 * lo decide el servidor. Separado de AuthSession para cargarse con el selector, no al arrancar.
 */
@Injectable({ providedIn: 'root', useFactory: () => inject(HttpActiveContext) })
export abstract class ActiveContext {
  /** Los contextos con asignación vigente de quien abrió la sesión; ninguno si no cargan. */
  abstract contexts(): Promise<readonly AccessContext[]>;
  /** Cambia el almacén activo sin volver a iniciar sesión; la sesión adopta la respuesta. */
  abstract switchTo(context: AccessContext): Promise<void>;
}

/** Adaptador sobre el contrato HTTP propuesto en 05-API; ver vault: Seguridad y usuarios. */
@Injectable({ providedIn: 'root' })
export class HttpActiveContext extends ActiveContext {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);
  private readonly auth = inject(AuthSession);

  async contexts(): Promise<readonly AccessContext[]> {
    const base = this.baseUrl();
    if (!base) return [];
    try {
      return await firstValueFrom(
        this.http.get<readonly AccessContext[]>(`${base}/session/contexts`),
      );
    } catch {
      return [];
    }
  }

  async switchTo(context: AccessContext): Promise<void> {
    const base = this.baseUrl();
    if (!base) throw new ContextChangeError('unavailable');
    const { warehouseId, ownerId } = context;
    try {
      const body = { warehouseId, ownerId };
      const grant = await firstValueFrom(
        this.http.put<SessionGrant>(`${base}/session/context`, body),
      );
      this.auth.adopt(grant);
    } catch (err) {
      throw new ContextChangeError(refusal(err));
    }
  }
}

function refusal(err: unknown): ContextChangeCode {
  if (!(err instanceof HttpErrorResponse)) return 'unavailable';
  const type = (err.error as { type?: unknown } | null)?.type;
  if (typeof type === 'string' && type.endsWith(':taskInProgress')) return 'taskInProgress';
  return err.status === 403 ? 'denied' : 'unavailable';
}
