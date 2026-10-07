import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SECURITY_API_URL } from '@ewms/core/security';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export const SECURITY_DEMO = true;

/** El simulador llega con la primera petición al Security Core: fuera del bundle inicial. */
const simulator = () => import('./security-simulator.interceptor');

export const DEMO_HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [
  (req, next) => {
    const base = inject(SECURITY_API_URL)();
    if (!base || !req.url.startsWith(`${base}/`)) return next(req);
    return from(simulator()).pipe(switchMap(({ simulate }) => simulate(req, base)));
  },
];

export const setDemoTaskRunning: ((running: boolean) => Promise<void>) | null = async (running) => {
  (await simulator()).setSimulatedTaskRunning(running);
};
