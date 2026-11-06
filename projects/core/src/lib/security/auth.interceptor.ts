import {
  HttpContextToken,
  HttpErrorResponse,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { from, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthSession, SESSION_REQUEST } from './auth-session';
import { SECURITY_API_URL } from './security-api-url';
import { STEP_UP } from './step-up';

/** La petición ya se repitió tras renovar: un segundo 401 no renueva otra vez. */
const RENEWED = new HttpContextToken<boolean>(() => false);
/** Ya se pidió el segundo factor: un segundo desafío no lo pide otra vez. */
const STEPPED = new HttpContextToken<boolean>(() => false);

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * El desafío de segundo factor: el 401 de RFC 9470, que no se arregla renovando, o el 428
 * `mfa_required` de la API Go. Ver vault: Requerimientos de la API para el login.
 */
function isStepUp(err: HttpErrorResponse): boolean {
  if (err.status === 428) return (err.error as { error?: unknown } | null)?.error === 'mfa_required';
  return (
    err.status === 401 &&
    /insufficient_user_authentication/.test(err.headers.get('WWW-Authenticate') ?? '')
  );
}

/**
 * Adjunta el token solo al Security Core (audiencia, RFC 9700 §2.3). Ante un 401 renueva una vez
 * y repite una vez (ADR 0021). Cada escritura lleva una `Idempotency-Key` que sus repeticiones
 * conservan; el desafío de RFC 9470 pide el segundo factor y repite una vez (ADR 0026).
 */
export const authInterceptor: HttpInterceptorFn = (original, next) => {
  const base = inject(SECURITY_API_URL)();
  if (!base || !original.url.startsWith(`${base}/`) || original.context.get(SESSION_REQUEST))
    return next(original);
  const auth = inject(AuthSession);
  const router = inject(Router);
  const stepUp = inject(STEP_UP, { optional: true });
  const req =
    original.method === 'GET'
      ? original
      : original.clone({ setHeaders: { 'Idempotency-Key': crypto.randomUUID() } });
  return next(withToken(req, auth.token())).pipe(
    catchError((err: unknown) => {
      const challenged = err instanceof HttpErrorResponse && isStepUp(err);
      if (
        !(err instanceof HttpErrorResponse) ||
        (err.status !== 401 && !challenged) ||
        req.context.get(challenged ? STEPPED : RENEWED) ||
        (challenged && !stepUp)
      )
        return throwError(() => err);
      if (challenged && stepUp) {
        req.context.set(STEPPED, true);
        return from(stepUp(err.headers.get('WWW-Authenticate') ?? '')).pipe(
          switchMap((verified) =>
            verified
              ? next(withToken(req, auth.token()))
              : throwError(
                  () => new HttpErrorResponse({ status: 401, error: { code: 'stepUpCancelled' } }),
                ),
          ),
        );
      }
      return from(auth.renew()).pipe(
        switchMap((renewed) => {
          if (!renewed) {
            void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
            return throwError(() => err);
          }
          req.context.set(RENEWED, true);
          return next(withToken(req, auth.token()));
        }),
      );
    }),
  );
};
