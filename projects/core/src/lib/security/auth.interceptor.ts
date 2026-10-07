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

/** La petición ya se repitió tras renovar: un segundo 401 no renueva otra vez. */
const RENEWED = new HttpContextToken<boolean>(() => false);

function withToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/** El desafío de segundo factor de RFC 9470 también es un 401, pero no se arregla renovando. */
function isStepUp(err: HttpErrorResponse): boolean {
  return /insufficient_user_authentication/.test(err.headers.get('WWW-Authenticate') ?? '');
}

/**
 * Adjunta el token solo al Security Core (audiencia, RFC 9700 §2.3). Ante un 401 renueva una vez
 * y repite la petición una vez; si no se puede renovar, lleva a iniciar sesión (ADR 0021).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(SECURITY_API_URL)();
  if (!base || !req.url.startsWith(`${base}/`) || req.context.get(SESSION_REQUEST))
    return next(req);
  const auth = inject(AuthSession);
  const router = inject(Router);
  return next(withToken(req, auth.token())).pipe(
    catchError((err: unknown) => {
      if (
        !(err instanceof HttpErrorResponse) ||
        err.status !== 401 ||
        isStepUp(err) ||
        req.context.get(RENEWED)
      )
        return throwError(() => err);
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
