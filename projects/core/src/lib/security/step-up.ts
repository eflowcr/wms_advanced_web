import { InjectionToken } from '@angular/core';

/**
 * Pide el segundo factor ante el desafío de RFC 9470 y resuelve `true` si quedó validado. Lo
 * provee el shell con el diálogo cargado al pedirlo; sin proveedor, el desafío llega a la pantalla.
 */
export const STEP_UP = new InjectionToken<(challenge: string) => Promise<boolean>>('STEP_UP');
