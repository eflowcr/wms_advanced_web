import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
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
import { STEP_UP } from './step-up';

/** Cabecera propia contra CSRF en renovar y cerrar: un sitio ajeno no la puede enviar sin CORS. */
export const CSRF_HEADER = 'X-EWMS-CSRF';

/** El desafío con que la consola pide el código cuando el login exige segundo factor. */
export const LOGIN_CHALLENGE = 'Bearer error="insufficient_user_authentication"';

/** Respuesta de login, verify-mfa y refresh: snake_case del OpenAPI o PascalCase de hoy. */
interface TokenBody {
  readonly access_token?: string;
  readonly AccessToken?: string;
  readonly session_id?: string;
  readonly SessionID?: string;
  readonly principal_id?: string;
  readonly PrincipalID?: string;
  readonly requires_mfa?: boolean;
  readonly RequiresMFA?: boolean;
}

interface MeBody {
  readonly principal_id?: string;
  readonly username?: string;
  readonly display_name?: string;
  readonly active_warehouse_id?: string | null;
}

/**
 * AuthSession sobre la API Go del Security Core (`/auth/*`, ADR 0028). El token de renovación
 * nunca se guarda en el navegador: viaja en la cookie HttpOnly; sin ella, se vuelve al login.
 */
@Injectable({ providedIn: 'root' })
export class CoreAuthAdapter extends AuthSession {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);
  private readonly access = inject(AccessStore);
  private readonly stepUp = inject(STEP_UP, { optional: true });
  private readonly current = signal<SessionInfo | null>(null);
  private accessToken: string | null = null;
  private renewing: Promise<boolean> | null = null;
  private sessionId: string | null = null;
  private pending: { sessionId: string | null; username: string } | null = null;

  readonly session = this.current.asReadonly();

  token(): string | null {
    return this.accessToken;
  }

  renew(): Promise<boolean> {
    this.renewing ??= this.refresh().finally(() => (this.renewing = null));
    return this.renewing;
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

  async signIn(credentials: Credentials): Promise<void> {
    const url = this.url('/auth/login');
    if (!url) throw new AuthError('unavailable');
    let body: TokenBody;
    try {
      body = await firstValueFrom(this.http.post<TokenBody>(url, credentials, sessionOptions()));
    } catch (err) {
      // Cuenta inactiva o bloqueada se dice igual que credenciales malas: no revela cuál.
      const rejected = err instanceof HttpErrorResponse && [400, 401, 403, 423].includes(err.status);
      throw new AuthError(rejected ? 'invalidCredentials' : 'unavailable');
    }
    if (!(body.requires_mfa ?? body.RequiresMFA)) return this.establish(body, credentials.username);
    this.pending = { sessionId: body.session_id ?? body.SessionID ?? null, username: credentials.username };
    const verified = this.stepUp ? await this.stepUp(LOGIN_CHALLENGE) : false;
    this.pending = null;
    if (!verified || !this.accessToken) throw new AuthError('secondFactorCancelled');
  }

  /** Valida el código del segundo factor: el del login en curso o el de una acción sensible. */
  async verifyPasscode(passcode: string): Promise<void> {
    const pending = this.pending;
    const code = passcode.trim();
    if (!pending) {
      // La elevación de la sesión en curso: el servidor la toma del Bearer.
      const url = this.url('/auth/step-up');
      if (!url || !this.accessToken) throw new AuthError('unavailable');
      const reply = await firstValueFrom(this.http.post<TokenBody>(url, { passcode: code }));
      this.accessToken = token(reply) ?? this.accessToken;
      return;
    }
    const url = this.url('/auth/verify-mfa');
    if (!url || !pending.sessionId) throw new AuthError('unavailable');
    const body = { session_id: pending.sessionId, passcode: code };
    const reply = await firstValueFrom(this.http.post<TokenBody>(url, body, sessionOptions()));
    await this.establish({ ...reply, session_id: pending.sessionId }, pending.username);
  }

  async signOut(): Promise<void> {
    const url = this.url('/auth/terminate');
    const bearer = this.accessToken;
    this.end();
    if (!url || !bearer) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${bearer}`, [CSRF_HEADER]: '1' });
    try {
      await firstValueFrom(this.http.post<void>(url, {}, { ...sessionOptions(), headers }));
    } catch {
      // La sesión local ya terminó; el servidor la vence por inactividad.
    }
  }

  private async refresh(): Promise<boolean> {
    const url = this.url('/auth/refresh');
    if (!url) return false;
    const headers = new HttpHeaders({ [CSRF_HEADER]: '1' });
    try {
      const body = await firstValueFrom(
        this.http.post<TokenBody>(url, null, { ...sessionOptions(), headers }),
      );
      await this.establish(body, null);
      return true;
    } catch {
      this.end();
      return false;
    }
  }

  private end(): void {
    this.accessToken = null;
    this.sessionId = null;
    this.current.set(null);
    this.access.disconnect();
  }

  private url(path: string): string | null {
    const base = this.baseUrl();
    return base ? `${base}${path}` : null;
  }

  /** Abre la sesión con el token recibido; el nombre y el almacén salen del servidor si los da. */
  private async establish(body: TokenBody, username: string | null): Promise<void> {
    const accessToken = token(body);
    if (!accessToken) throw new AuthError('unavailable');
    const claims = readClaims(accessToken);
    this.accessToken = accessToken;
    this.sessionId = body.session_id ?? body.SessionID ?? claims.sid ?? this.sessionId;
    const me = await this.me();
    const userId = body.principal_id ?? body.PrincipalID ?? me?.principal_id ?? claims.sub ?? '';
    const previous = this.current();
    const kept = previous?.userId === userId ? previous : null;
    this.adopt({
      accessToken,
      session: {
        userId,
        name: me?.display_name || me?.username || username || kept?.name || userId,
        warehouseId: me?.active_warehouse_id ?? kept?.warehouseId ?? '',
        ownerId: kept?.ownerId ?? '',
      },
    });
  }

  /** Fuera del interceptor: un 401 aquí no debe pedir otra renovación desde dentro de una. */
  private async me(): Promise<MeBody | null> {
    const url = this.url('/auth/me');
    if (!url || !this.accessToken) return null;
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.accessToken}` });
    try {
      return await firstValueFrom(this.http.get<MeBody>(url, { ...sessionOptions(), headers }));
    } catch {
      return null;
    }
  }
}

function token(body: TokenBody | null): string | null {
  return body?.access_token ?? body?.AccessToken ?? null;
}

/** Lee `sub` y `sid` del token para la sesión; la firma la valida el servidor, no la consola. */
function readClaims(jwt: string): { sub?: string; sid?: string } {
  try {
    const payload = jwt.split('.')[1] ?? '';
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as unknown;
    return claims && typeof claims === 'object' ? claims : {};
  } catch {
    return {};
  }
}
