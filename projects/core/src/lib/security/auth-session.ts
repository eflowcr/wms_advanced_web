import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { sameContext } from './access';
import { AccessStore } from './access-store';
import { SECURITY_API_URL } from './security-api-url';

/** Marca las peticiones de sesión: no llevan token ni disparan otra renovación. */
export const SESSION_REQUEST = new HttpContextToken<boolean>(() => false);

/** Lo que el servidor dice de la sesión: quién es y en qué almacén y propietario trabaja. */
export interface SessionInfo {
  readonly userId: string;
  readonly name: string;
  readonly warehouseId: string;
  readonly ownerId: string;
}

export interface SessionGrant {
  readonly accessToken: string;
  readonly session: SessionInfo;
}

export interface Credentials {
  readonly username: string;
  readonly password: string;
}

export type AuthErrorCode = 'invalidCredentials' | 'unavailable';
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}

/**
 * Puerto de sesión (ADR 0021): token de acceso solo en memoria y renovación en una cookie que el
 * script no lee. Cambiar el mecanismo de inicio de sesión cambia el adaptador, no las pantallas.
 */
@Injectable({ providedIn: 'root', useFactory: () => inject(HttpAuthSession) })
export abstract class AuthSession {
  abstract readonly session: Signal<SessionInfo | null>;
  abstract token(): string | null;
  abstract signIn(credentials: Credentials): Promise<void>;
  /** Una sola renovación en vuelo para todos los que la pidan; `false` cierra la sesión. */
  abstract renew(): Promise<boolean>;
  abstract signOut(): Promise<void>;
  /** Adopta la sesión que el servidor emitió por otra vía, como el cambio de almacén. */
  abstract adopt(grant: SessionGrant): void;
}

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
      this.adopt(await firstValueFrom(this.http.post<SessionGrant>(url, credentials, options())));
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
      await firstValueFrom(this.http.delete<void>(url, options()));
    } catch {
      // La sesión local ya terminó; el servidor la vence por su lado.
    }
  }

  private async refresh(): Promise<boolean> {
    const url = this.url('/session/refresh');
    if (!url) return false;
    try {
      this.adopt(await firstValueFrom(this.http.post<SessionGrant>(url, null, options())));
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

function options() {
  return { withCredentials: true, context: new HttpContext().set(SESSION_REQUEST, true) };
}
