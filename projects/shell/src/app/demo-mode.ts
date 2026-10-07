import type { HttpInterceptorFn } from '@angular/common/http';
import type { Actor } from '@ewms/core/security';

export const SECURITY_DEMO = false;
export const DEMO_HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [];
/** Producción no simula sesión: la identidad sale solo del servidor (ADR 0021). */
export const setDemoSession: ((actor: Actor | null) => Promise<void>) | null = null;
