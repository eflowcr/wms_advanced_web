import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { AccessContext } from './access';
import { ActiveContext, ContextChangeError, type ContextChangeCode } from './active-context';
import { AuthSession, type SessionGrant } from './auth-session';
import { SECURITY_API_URL } from './security-api-url';

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
