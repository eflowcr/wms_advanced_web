import { InjectionToken, signal, type Signal } from '@angular/core';

/**
 * URL base del Security Core; el shell la lee de la configuración de ejecución. Sin ella, nada
 * sale. Archivo propio: lo usa el arranque y no debe arrastrar el gateway a la ruta crítica.
 */
export const SECURITY_API_URL = new InjectionToken<Signal<string | undefined>>('SECURITY_API_URL', {
  providedIn: 'root',
  factory: () => signal(undefined),
});
