import type { HttpInterceptorFn } from '@angular/common/http';
import type { Actor } from '@ewms/core/security';
import { securitySimulatorInterceptor, setSimulatedSession } from './security-simulator.interceptor';

export const SECURITY_DEMO = true;
export const DEMO_HTTP_INTERCEPTORS: readonly HttpInterceptorFn[] = [securitySimulatorInterceptor];
export const setDemoSession: ((actor: Actor | null) => void) | null = setSimulatedSession;
