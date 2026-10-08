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
  type AccessContext,
  type Actor,
  type Assignment,
  type Profile,
  type ReviewDecision,
  SECURITY_API_URL,
  SecurityError,
  sameContext,
  type SecurityErrorCode,
  type SecurityRequest,
  type SecurityUser,
  type SessionGrant,
} from '@ewms/core/security';
import type { MemoryOptions, MemorySecurityGateway } from '@ewms/security';
import { from, type Observable, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

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
let taskRunning = false;
let reinforcedAt: number | null = null;
/** Respuestas por `Idempotency-Key`: repetir una escritura no la aplica dos veces. */
const replies = new Map<string, unknown>();

/**
 * Solo la demostración: el catálogo no declara sensibles (la lista es del CTO); el servidor
 * simulado pide segundo factor al activar o desactivar un usuario para mostrar el flujo.
 */
const STEP_UP_ROUTES = new Set(['PATCH /users/:id/status']);
const STEP_UP_MAX_AGE = 300;

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
  taskRunning = false;
  reinforcedAt = null;
  replies.clear();
}

/** Una tarea en ejecución bloquea el cambio de almacén, como lo haría el servidor (PACQ-09). */
export function setSimulatedTaskRunning(running: boolean): void {
  taskRunning = running;
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
  selfAssignment: 403,
  invalid: 400,
  conflict: 409,
  duplicate: 409,
  lastAdmin: 409,
  taskInProgress: 409,
  segregation: 409,
  externalAffiliation: 409,
  dependency: 409,
};

/** Rechazo con RFC 9457: un `type` estable, los perfiles en conflicto y ningún detalle interno. */
function problem(
  req: HttpRequest<unknown>,
  code: string,
  status = STATUS[code] ?? 503,
  conflicts: readonly string[] = [],
) {
  return new HttpErrorResponse({
    url: req.url,
    status,
    headers: new HttpHeaders({ 'Content-Type': 'application/problem+json' }),
    error: {
      type: `urn:ewms:security:${code}`,
      status,
      instance: req.url,
      code,
      ...(conflicts.length ? { conflicts } : {}),
    },
  });
}

const ok = (body: unknown = null) => new HttpResponse({ status: 200, body });

/** El desafío de RFC 9470: un 401 que pide un factor reciente, sin renovar el token. */
function challenge(req: HttpRequest<unknown>) {
  const value =
    'Bearer error="insufficient_user_authentication", ' +
    `acr_values="urn:ewms:acr:otp", max_age=${STEP_UP_MAX_AGE}`;
  return new HttpErrorResponse({
    url: req.url,
    status: 401,
    headers: new HttpHeaders({ 'WWW-Authenticate': value }),
    error: { type: 'urn:ewms:security:stepUpRequired', status: 401 },
  });
}

const reinforced = () =>
  reinforcedAt !== null && Date.now() - reinforcedAt < STEP_UP_MAX_AGE * 1000;

/** Los contextos donde la persona tiene alguna concesión, con su nombre; sin ninguno, ninguno. */
async function assigned(userId: string) {
  const gateway = await server();
  const signal = new AbortController().signal;
  const { demoSnapshot } = await import('@ewms/security');
  const found: { context: AccessContext; name: string }[] = [];
  for (const context of demoSnapshot().contexts) {
    const { user, grants } = await gateway.access({ userId, ...context }, signal);
    if (user && Object.keys(grants).length > 0) found.push({ context, name: user.name });
  }
  return found;
}

/** La sesión en ese contexto y su token nuevo; el anterior deja de valer. */
function open(userId: string, context: AccessContext, name: string): SessionGrant {
  session = { userId, warehouseId: context.warehouseId, ownerId: context.ownerId };
  token = issue();
  return { accessToken: token, session: { ...session, name } };
}

/** La sesión y su token nuevos en el primer contexto asignado. Sin usuario activo, `null`. */
async function grant(userId: string): Promise<SessionGrant | null> {
  const [first] = await assigned(userId);
  return first ? open(userId, first.context, first.name) : null;
}

/** Inicio, renovación y cierre: no piden token; la renovación usa la sesión, como una cookie. */
async function sessionRoute(req: HttpRequest<unknown>, route: string) {
  if (route === 'POST /session') {
    reinforcedAt = null;
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
  reinforcedAt = null;
  return ok();
}

const SESSION_ROUTES = new Set(['POST /session', 'POST /session/refresh', 'DELETE /session']);

async function answer(req: HttpRequest<unknown>, path: string, actor: Actor) {
  const gateway = await server();
  const request: SecurityRequest = { actor, signal: new AbortController().signal };
  const target = (/^\/(?:users|reviews)\/([^/]+)(\/assignments|\/status|\/decisions)?$/.exec(
    path,
  ) ?? [])[1];
  const id = target === undefined ? '' : decodeURIComponent(target);
  const route = `${req.method} ${path.replace(/^\/(users|profiles|reviews)\/[^/]+/, '/$1/:id')}`;
  if (STEP_UP_ROUTES.has(route) && !reinforced()) throw challenge(req);
  switch (route) {
    case 'POST /session/step-up': {
      // La demostración acepta cualquier código de seis dígitos salvo 000000, que rechaza.
      const code = (req.body as { code?: unknown } | null)?.code;
      if (typeof code !== 'string' || !/^\d{6}$/.test(code) || code === '000000')
        throw problem(req, 'invalid');
      const { user } = await gateway.access(actor, request.signal);
      reinforcedAt = Date.now();
      token = issue();
      return ok({ accessToken: token, session: { ...actor, name: user?.name ?? '' } });
    }
    case 'GET /session/contexts':
      return ok((await assigned(actor.userId)).map(({ context }) => context));
    case 'PUT /session/context': {
      if (taskRunning) throw problem(req, 'taskInProgress');
      const wanted = req.body as AccessContext;
      const target = (await assigned(actor.userId)).find(({ context }) =>
        sameContext(context, wanted),
      );
      if (!target) throw problem(req, 'denied');
      return ok(open(actor.userId, target.context, target.name));
    }
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
    case 'GET /reviews':
      return ok(await gateway.reviews(request));
    case 'POST /reviews':
      return ok(await gateway.startReview(request, req.body as { name: string; dueDate: string }));
    case 'POST /reviews/:id/decisions': {
      const body = req.body as {
        assignment: Assignment;
        decision: ReviewDecision;
        version: number;
      };
      return ok(await gateway.decide(request, id, body.assignment, body.decision, body.version));
    }
    case 'POST /assignments': {
      const body = req.body as { assignments: readonly Assignment[]; version: number };
      return ok(await gateway.addAssignments(request, body.assignments, body.version));
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
  const key = req.method === 'GET' ? null : req.headers.get('Idempotency-Key');
  if (key && replies.has(key)) return of(ok(replies.get(key)));
  const answering = SESSION_ROUTES.has(route)
    ? sessionRoute(req, route)
    : answer(req, path, actor!);
  return from(answering).pipe(
    tap((response) => {
      if (key) replies.set(key, response.body);
    }),
    catchError((err: unknown): Observable<never> => {
      if (err instanceof HttpErrorResponse) return throwError(() => err);
      if (!(err instanceof SecurityError)) return throwError(() => problem(req, 'unavailable'));
      return throwError(() => problem(req, err.code, undefined, err.conflicts));
    }),
  );
}
