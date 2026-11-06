import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { AuthSession } from './auth-session';

/** Solo una ruta propia de la consola: nunca otro origen ni `//host` (redirección abierta). */
export function safeReturnUrl(value: string | null): string {
  return value && /^\/(?![/\\])/.test(value) ? value : '/';
}

/**
 * Protege la capa autenticada (ADR 0012). Sin sesión en memoria intenta recuperarla con la
 * cookie de renovación; si no, lleva a iniciar sesión con la dirección pedida.
 */
export const sessionGuard: CanMatchFn = async () => {
  const auth = inject(AuthSession);
  const router = inject(Router);
  if (auth.session() || (await auth.renew())) return true;
  const requested = router.currentNavigation()?.extractedUrl;
  const returnUrl = requested ? router.serializeUrl(requested) : '/';
  return router.createUrlTree(['/login'], returnUrl === '/' ? {} : { queryParams: { returnUrl } });
};
