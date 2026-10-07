import { HttpContextToken, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AccessStore } from './access-store';

/** Marca la consulta de permisos efectivos: su propio 403 no provoca otra relectura. */
export const ACCESS_QUERY = new HttpContextToken<boolean>(() => false);

/**
 * Ante un 403 pide a AccessStore releer permisos, que junta las relecturas (RFE-02).
 * La petición rechazada nunca se reintenta.
 */
export const securityAccessInterceptor: HttpInterceptorFn = (req, next) => {
  const access = inject(AccessStore);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 403 && !req.context.get(ACCESS_QUERY))
        void access.refresh();
      return throwError(() => err);
    }),
  );
};
