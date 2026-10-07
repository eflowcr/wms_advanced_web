import {
  HttpErrorResponse,
  HttpHeaders,
  type HttpInterceptorFn,
  type HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  type Actor,
  type Assignment,
  type Profile,
  SECURITY_API_URL,
  SecurityError,
  type SecurityErrorCode,
  type SecurityRequest,
  type SecurityUser,
} from '@ewms/core/security';
import type { MemoryOptions, MemorySecurityGateway } from '@ewms/security';
import { from, type Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * El servidor simulado del contrato (ADR 0022). Solo entra al artefacto de demostración y al de
 * desarrollo por fileReplacements; la sesión simulada la fija la franja de demostración.
 */
let options: MemoryOptions = {};
let backend: Promise<MemorySecurityGateway> | null = null;
let session: Actor | null = null;
let nextFailure: SecurityErrorCode | null = null;

/** Vuelve al estado inicial: sin sesión y con los datos de demostración. */
export function resetSimulator(next: MemoryOptions = {}): void {
  options = next;
  backend = null;
  session = null;
  nextFailure = null;
}

/** La sesión que el servidor simulado reconoce; sin ella, todo se deniega. */
export function setSimulatedSession(actor: Actor | null): void {
  session = actor ? { ...actor } : null;
}

/** La siguiente petición falla con ese código, para reproducir rechazos. */
export function setSimulatorFailure(code: SecurityErrorCode): void {
  nextFailure = code;
}

function server(): Promise<MemorySecurityGateway> {
  backend ??= import('@ewms/security').then(
    ({ MemorySecurityGateway }) => new MemorySecurityGateway(options),
  );
  return backend;
}

const STATUS: Readonly<Record<string, number>> = {
  unauthenticated: 401,
  denied: 403,
  selfEscalation: 403,
  delegation: 403,
  invalid: 400,
  conflict: 409,
  duplicate: 409,
  lastAdmin: 409,
};

/** Rechazo con RFC 9457: un `type` estable y ningún detalle interno. */
function problem(req: HttpRequest<unknown>, code: string, status = STATUS[code] ?? 503) {
  return new HttpErrorResponse({
    url: req.url,
    status,
    headers: new HttpHeaders({ 'Content-Type': 'application/problem+json' }),
    error: { type: `urn:ewms:security:${code}`, status, instance: req.url, code },
  });
}

const ok = (body: unknown = null) => new HttpResponse({ status: 200, body });

async function answer(req: HttpRequest<unknown>, path: string, actor: Actor) {
  const gateway = await server();
  const request: SecurityRequest = { actor, signal: new AbortController().signal };
  const target = (/^\/users\/([^/]+)(\/assignments|\/status)?$/.exec(path) ?? [])[1];
  const id = target === undefined ? '' : decodeURIComponent(target);
  const route = `${req.method} ${path.replace(/^\/(users|profiles)\/[^/]+/, '/$1/:id')}`;
  switch (route) {
    case 'GET /access':
      return ok(await gateway.access(actor, request.signal));
    case 'GET /snapshot':
      return ok(await gateway.snapshot(request));
    case 'GET /users':
      return ok(await gateway.users(request));
    case 'GET /inspect':
      return ok(
        await gateway.inspect(request, {
          userId: req.params.get('userId') ?? '',
          warehouseId: req.params.get('warehouseId') ?? '',
          ownerId: req.params.get('ownerId') ?? '',
        }),
      );
    case 'PUT /profiles/:id':
      return ok(await gateway.saveProfile(request, req.body as Profile));
    case 'PUT /users/:id':
      return ok(await gateway.saveUser(request, req.body as SecurityUser));
    case 'PATCH /users/:id/status': {
      const body = req.body as { active: boolean; version: number };
      return ok(await gateway.setUserStatus(request, id, body.active, body.version));
    }
    case 'PUT /users/:id/assignments': {
      const body = req.body as { assignments: readonly Assignment[]; version: number };
      return ok(await gateway.setAssignments(request, id, body.assignments, body.version));
    }
    default:
      throw problem(req, 'notFound', 404);
  }
}

export const securitySimulatorInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(SECURITY_API_URL)();
  if (!base || !req.url.startsWith(`${base}/`)) return next(req);
  const actor = session;
  if (!actor) return throwError(() => problem(req, 'unauthenticated'));
  const failure = nextFailure;
  nextFailure = null;
  if (failure) return throwError(() => problem(req, failure));
  return from(answer(req, req.url.slice(base.length), actor)).pipe(
    catchError((err: unknown): Observable<never> => {
      if (err instanceof HttpErrorResponse) return throwError(() => err);
      const code = err instanceof SecurityError ? err.code : 'unavailable';
      return throwError(() => problem(req, code));
    }),
  );
};
