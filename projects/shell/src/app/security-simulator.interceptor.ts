import {
  HttpErrorResponse,
  type HttpEvent,
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
  type SessionGrant,
} from '@ewms/core/security';
import type { MemoryOptions, MemorySecurityGateway } from '@ewms/security';
import { from, type Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * El servidor simulado del contrato (ADR 0022). Solo entra al artefacto de demostración y al de
 * desarrollo por fileReplacements. La sesión vive en memoria: recargar la página la termina.
 */
let options: MemoryOptions = {};
let backend: Promise<MemorySecurityGateway> | null = null;
let session: Actor | null = null;
let token: string | null = null;
let issued = 0;
let nextFailure: SecurityErrorCode | null = null;

function issue(): string {
  issued += 1;
  return `simulated-${issued}`;
}

/** Vuelve al estado inicial: sin sesión y con los datos de demostración. */
export function resetSimulator(next: MemoryOptions = {}): void {
  options = next;
  backend = null;
  session = null;
  token = null;
  nextFailure = null;
}

/**
 * La franja de demostración cambia quién y dónde sin volver a iniciar sesión; el token sigue.
 * Devuelve el token vigente, o `null` si la sesión termina.
 */
export function setSimulatedSession(actor: Actor | null): string | null {
  session = actor ? { ...actor } : null;
  token = actor ? (token ?? issue()) : null;
  return token;
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
  invalidCredentials: 401,
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

/** La sesión y su token nuevos; el anterior deja de valer. Sin usuario activo, `null`. */
async function grant(userId: string): Promise<SessionGrant | null> {
  const gateway = await server();
  const signal = new AbortController().signal;
  const { demoSnapshot } = await import('@ewms/security');
  for (const context of demoSnapshot().contexts) {
    const candidate = { userId, ...context };
    const { user, grants } = await gateway.access(candidate, signal);
    if (!user || Object.keys(grants).length === 0) continue;
    session = { ...candidate };
    token = issue();
    return { accessToken: token, session: { ...session, name: user.name } };
  }
  return null;
}

/** Inicio, renovación y cierre: no piden token; la renovación usa la sesión, como una cookie. */
async function sessionRoute(req: HttpRequest<unknown>, route: string) {
  if (route === 'POST /session') {
    const body = req.body as { username?: unknown; password?: unknown } | null;
    const { username, password } = body ?? {};
    const valid = typeof username === 'string' && typeof password === 'string' && password !== '';
    const granted = valid ? await grant(username) : null;
    if (!granted) throw problem(req, 'invalidCredentials');
    return ok(granted);
  }
  if (route === 'POST /session/refresh') {
    const current = session;
    const { user } = current
      ? await (await server()).access(current, new AbortController().signal)
      : { user: null };
    if (!current || !user) throw problem(req, 'unauthenticated');
    token = issue();
    return ok({ accessToken: token, session: { ...current, name: user.name } });
  }
  session = null;
  token = null;
  return ok();
}

const SESSION_ROUTES = new Set(['POST /session', 'POST /session/refresh', 'DELETE /session']);

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
  return base && req.url.startsWith(`${base}/`) ? simulate(req, base) : next(req);
};

/** Responde una petición al Security Core como lo haría el servidor. */
export function simulate(req: HttpRequest<unknown>, base: string): Observable<HttpEvent<unknown>> {
  const path = req.url.slice(base.length);
  const route = `${req.method} ${path}`;
  const actor = session;
  const authorized = actor !== null && req.headers.get('Authorization') === `Bearer ${token}`;
  if (!SESSION_ROUTES.has(route) && !authorized)
    return throwError(() => problem(req, 'unauthenticated'));
  const failure = nextFailure;
  nextFailure = null;
  if (failure) return throwError(() => problem(req, failure));
  const answering = SESSION_ROUTES.has(route)
    ? sessionRoute(req, route)
    : answer(req, path, actor!);
  return from(answering).pipe(
    catchError((err: unknown): Observable<never> => {
      if (err instanceof HttpErrorResponse) return throwError(() => err);
      const code = err instanceof SecurityError ? err.code : 'unavailable';
      return throwError(() => problem(req, code));
    }),
  );
}
