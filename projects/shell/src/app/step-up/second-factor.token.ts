import { InjectionToken } from '@angular/core';

/**
 * Un tipo de segundo factor para el diálogo genérico (ADR 0026). `inputKey` nombra el campo que
 * pide, o `null` si no pide nada escrito. `verify` deja la sesión con el token reforzado.
 */
export interface SecondFactor {
  readonly inputKey: string | null;
  verify(value: string): Promise<void>;
}

/** El factor que valida el diálogo; cada modo lo provee en `SECURITY_PROVIDERS` (ADR 0028). */
export const SECOND_FACTOR = new InjectionToken<SecondFactor>('SECOND_FACTOR');
