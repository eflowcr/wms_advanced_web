import { HttpContext, HttpContextToken } from '@angular/common/http';
import type { Signal } from '@angular/core';

/** Marca las peticiones de sesión: no llevan token ni disparan otra renovación. */
export const SESSION_REQUEST = new HttpContextToken<boolean>(() => false);

/** Lo que el servidor dice de la sesión: quién es y en qué almacén y propietario trabaja. */
export interface SessionInfo {
  readonly userId: string;
  readonly name: string;
  readonly warehouseId: string;
  readonly ownerId: string;
}

export interface SessionGrant {
  readonly accessToken: string;
  readonly session: SessionInfo;
}

export interface Credentials {
  readonly username: string;
  readonly password: string;
}

export type AuthErrorCode = 'invalidCredentials' | 'secondFactorCancelled' | 'unavailable';
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
  }
}

/**
 * Puerto de sesión (ADR 0021): token de acceso solo en memoria y renovación en una cookie que el
 * script no lee. El shell provee el adaptador de su modo (ADR 0028); las pantallas no cambian.
 */
export abstract class AuthSession {
  abstract readonly session: Signal<SessionInfo | null>;
  abstract token(): string | null;
  abstract signIn(credentials: Credentials): Promise<void>;
  /** Una sola renovación en vuelo para todos los que la pidan; `false` cierra la sesión. */
  abstract renew(): Promise<boolean>;
  abstract signOut(): Promise<void>;
  /** Adopta la sesión que el servidor emitió por otra vía, como el cambio de almacén. */
  abstract adopt(grant: SessionGrant): void;
}


/** Las peticiones de sesión: con la cookie, sin el token y fuera del interceptor. */
export function sessionOptions() {
  return { withCredentials: true, context: new HttpContext().set(SESSION_REQUEST, true) };
}
