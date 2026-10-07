import type { HttpInterceptorFn } from '@angular/common/http';

export const SECURITY_DEMO = false;
export const DEMO_HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [];
/** Producción no simula el servidor: no hay tarea simulada que bloquee nada. */
export const setDemoTaskRunning: ((running: boolean) => Promise<void>) | null = null;
