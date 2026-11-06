import type { HttpInterceptorFn } from '@angular/common/http';
import { inject, type Provider } from '@angular/core';
import { AuthSession, HttpAuthSession, SECURITY_API_URL } from '@ewms/core/security';
import { OtpFactor } from './step-up/second-factor';
import { SECOND_FACTOR } from './step-up/second-factor.token';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export const SECURITY_DEMO = true;
/** El artefacto sintético de las E2E usa el contrato propuesto, que responde el simulador. */
export const SECURITY_PROVIDERS: readonly Provider[] = [
  { provide: AuthSession, useExisting: HttpAuthSession },
  { provide: SECOND_FACTOR, useExisting: OtpFactor },
];

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
