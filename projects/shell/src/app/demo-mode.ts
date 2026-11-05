import type { HttpInterceptorFn } from '@angular/common/http';
import { inject, type Provider } from '@angular/core';
import { AuthSession, CoreAuthSession } from '@ewms/core/security';
import { SECOND_FACTOR, type SecondFactor } from './step-up/second-factor.token';

export const SECURITY_DEMO = false;
export const DEMO_HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [];
/**
 * En desarrollo y producción la sesión habla con la API Go del Security Core (ADR 0028). Al
 * arrancar va solo la sesión; el área autenticada y el diálogo eligen sus adaptadores al cargar.
 */
export const SECURITY_PROVIDERS: readonly Provider[] = [
  { provide: AuthSession, useExisting: CoreAuthSession },
  { provide: SECOND_FACTOR, useFactory: coreOtpFactor },
];

/** t(shell.stepUp.otp) */
/** El código de un solo uso, validado por `/auth/verify-mfa` de la API Go. */
function coreOtpFactor(): SecondFactor {
  const auth = inject(CoreAuthSession);
  return { inputKey: 'shell.stepUp.otp', verify: (code) => auth.verifyPasscode(code) };
}
/** Producción no simula el servidor: no hay tarea simulada que bloquee nada. */
export const setDemoTaskRunning: ((running: boolean) => Promise<void>) | null = null;
