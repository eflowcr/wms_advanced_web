import { HttpClient, HttpContext, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, fromEvent, type Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  type AccessResult,
  type Actor,
  type Assignment,
  type Grants,
  type Profile,
  type SecurityGateway,
  type SecurityRequest,
  type SecuritySnapshot,
  type SecurityUser,
  SecurityError,
  type SecurityErrorCode,
} from './access';
import { SECURITY_API_URL } from './security-api-url';
import { ACCESS_QUERY } from './security-access.interceptor';

const VALID_CODES = new Set<SecurityErrorCode>([
  'denied',
  'invalid',
  'duplicate',
  'conflict',
  'lastAdmin',
  'selfEscalation',
  'delegation',
  'selfAssignment',
  'segregation',
  'externalAffiliation',
  'dependency',
  'stepUpCancelled',
  'unavailable',
  'aborted',
]);

function isSecurityErrorCode(value: string): value is SecurityErrorCode {
  return VALID_CODES.has(value as SecurityErrorCode);
}

/** Traduce una respuesta HTTP con RFC 9457 a un SecurityError de la consola. */
export function parseProblemError(err: unknown, signal?: AbortSignal): Error {
  if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
    return new SecurityError('aborted');
  }
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Record<string, unknown> | null;
    if (body && typeof body === 'object') {
      const code = body['code'];
      const conflicts = body['conflicts'];
      if (typeof code === 'string' && isSecurityErrorCode(code)) {
        return new SecurityError(
          code,
          Array.isArray(conflicts) ? conflicts.filter((c) => typeof c === 'string') : [],
        );
      }
      const typeStr = body['type'];
      if (typeof typeStr === 'string') {
        const match = typeStr.match(/([a-zA-Z]+)$/);
        if (match && match[1] && isSecurityErrorCode(match[1])) {
          return new SecurityError(match[1]);
        }
      }
    }
    if (err.status === 401 || err.status === 403) return new SecurityError('denied');
    if (err.status === 409) return new SecurityError('conflict');
    if (err.status === 400) return new SecurityError('invalid');
    return new SecurityError('unavailable');
  }
  return err instanceof SecurityError ? err : new SecurityError('unavailable');
}

/**
 * SecurityGateway sobre el contrato HTTP propuesto (ADR 0022). Ninguna petición afirma
 * identidad ni almacén: el servidor los toma de la sesión (ADR 0021).
 */
@Injectable({ providedIn: 'root' })
export class HttpSecurityGateway implements SecurityGateway {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(SECURITY_API_URL);
  private readonly accessQuery = new HttpContext().set(ACCESS_QUERY, true);
  private readonly listeners = new Set<() => void>();

  async access(actor: Actor | null, signal: AbortSignal): Promise<AccessResult> {
    if (!actor) return { grants: {}, user: null };
    return this.request(
      (url) => this.http.get<AccessResult>(url('/access'), { context: this.accessQuery }),
      signal,
    );
  }

  async snapshot(req: SecurityRequest): Promise<SecuritySnapshot> {
    return this.request((url) => this.http.get<SecuritySnapshot>(url('/snapshot')), req.signal);
  }

  async inspect(req: SecurityRequest, target: Actor): Promise<Grants> {
    const params = new HttpParams()
      .set('userId', target.userId)
      .set('warehouseId', target.warehouseId)
      .set('ownerId', target.ownerId);
    return this.request((url) => this.http.get<Grants>(url('/inspect'), { params }), req.signal);
  }

  async users(req: SecurityRequest): Promise<readonly SecurityUser[]> {
    return this.request((url) => this.http.get<readonly SecurityUser[]>(url('/users')), req.signal);
  }

  async saveProfile(req: SecurityRequest, profile: Profile): Promise<void> {
    await this.request(
      (url) => this.http.put<void>(url(`/profiles/${encodeURIComponent(profile.id)}`), profile),
      req.signal,
    );
    this.notify();
  }

  async setAssignments(
    req: SecurityRequest,
    userId: string,
    assignments: readonly Assignment[],
    version: number,
  ): Promise<void> {
    await this.request(
      (url) =>
        this.http.put<void>(url(`/users/${encodeURIComponent(userId)}/assignments`), {
          assignments,
          version,
        }),
      req.signal,
    );
    this.notify();
  }

  async saveUser(req: SecurityRequest, user: SecurityUser): Promise<void> {
    await this.request(
      (url) => this.http.put<void>(url(`/users/${encodeURIComponent(user.id)}`), user),
      req.signal,
    );
    this.notify();
  }

  async setUserStatus(
    req: SecurityRequest,
    id: string,
    active: boolean,
    version: number,
  ): Promise<void> {
    await this.request(
      (url) =>
        this.http.patch<void>(url(`/users/${encodeURIComponent(id)}/status`), { active, version }),
      req.signal,
    );
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** Abortar la señal cancela la petición en vuelo; sin URL configurada no sale ninguna. */
  private async request<T>(
    send: (url: (path: string) => string) => Observable<T>,
    signal: AbortSignal,
  ): Promise<T> {
    if (signal.aborted) throw new SecurityError('aborted');
    const base = this.baseUrl();
    if (!base) throw new SecurityError('unavailable');
    try {
      return await firstValueFrom(
        send((path) => `${base}${path}`).pipe(takeUntil(fromEvent(signal, 'abort'))),
      );
    } catch (err) {
      throw parseProblemError(err, signal);
    }
  }
}
