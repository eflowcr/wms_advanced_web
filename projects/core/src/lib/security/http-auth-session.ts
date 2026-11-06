import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { sameContext } from './access';
import { AccessStore } from './access-store';
import {
  AuthError,
  AuthSession,
  sessionOptions,
  type Credentials,
  type SessionGrant,
  type SessionInfo,
} from './auth-session';
import { SECURITY_API_URL } from './security-api-url';

/** Adaptador sobre el contrato HTTP propuesto en 05-API; ver vault: Seguridad y usuarios. */
@Injectable({ providedIn: 'root' })
export class HttpAuthSession extends AuthSession {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);
  private readonly access = inject(AccessStore);
  private readonly current = signal<SessionInfo | null>(null);
  private accessToken: string | null = null;
  private renewing: Promise<boolean> | null = null;

  readonly session = this.current.asReadonly();

  token(): string | null {
    return this.accessToken;
  }

  async signIn(credentials: Credentials): Promise<void> {
    const url = this.url('/session');
    if (!url) throw new AuthError('unavailable');
    try {
      this.adopt(await firstValueFrom(this.http.post<SessionGrant>(url, credentials, sessionOptions())));
    } catch (err) {
      const rejected =
        err instanceof HttpErrorResponse && (err.status === 400 || err.status === 401);
      throw new AuthError(rejected ? 'invalidCredentials' : 'unavailable');
    }
  }

  renew(): Promise<boolean> {
    this.renewing ??= this.refresh().finally(() => (this.renewing = null));
    return this.renewing;
  }

  async signOut(): Promise<void> {
    const url = this.url('/session');
    this.end();
    if (!url) return;
    try {
      await firstValueFrom(this.http.delete<void>(url, sessionOptions()));
    } catch {
      // La sesión local ya terminó; el servidor la vence por su lado.
    }
  }

  private async refresh(): Promise<boolean> {
    const url = this.url('/session/refresh');
    if (!url) return false;
    try {
      this.adopt(await firstValueFrom(this.http.post<SessionGrant>(url, null, sessionOptions())));
      return true;
    } catch {
      this.end();
      return false;
    }
  }

  /** La sesión del servidor manda: si los permisos son de otra persona o contexto, se releen. */
  adopt(grant: SessionGrant): void {
    this.accessToken = grant.accessToken;
    this.current.set(grant.session);
    const { userId, warehouseId, ownerId } = grant.session;
    const actor = this.access.actor();
    if (this.access.status() === 'idle' || !actor) return;
    if (actor.userId !== userId || !sameContext(actor, grant.session))
      void this.access.select({ userId, warehouseId, ownerId });
  }

  private end(): void {
    this.accessToken = null;
    this.current.set(null);
    this.access.disconnect();
  }

  private url(path: string): string | null {
    const base = this.baseUrl();
    return base ? `${base}${path}` : null;
  }
}
