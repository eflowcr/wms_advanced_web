import {
  ErrorHandler,
  inject,
  Injectable,
  InjectionToken,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';

/**
 * Lo que un error entrega a la telemetría: su tipo y sus marcos de pila, nada más. El mensaje
 * puede traer datos del usuario y la URL sus búsquedas: no viajan (PLN-WMS-002 §10, AUD-013).
 */
export interface ErrorReport {
  readonly name: string;
  readonly frames: readonly string[];
}

/** El puerto. Proveedor y destino, **(pendiente)** del CTO y backend (PLN-WMS-002 §11). */
export interface Telemetry {
  error(report: ErrorReport): void;
}

/** Sin proveedor, no envía nada: el asiento existe y nadie escucha. */
export const TELEMETRY = new InjectionToken<Telemetry>('TELEMETRY', {
  providedIn: 'root',
  factory: () => ({ error: () => undefined }),
});

/** Un marco de V8 (`    at f (url:1:2)`) o de Firefox y Safari (`f@url:1:2`); nunca una línea de texto. */
const FRAME = /^\s+at \S.*:\d+:\d+\)?$|^[^\s@]*@\S+:\d+:\d+$/;

/** El informe de cualquier cosa que se lance, sin su mensaje. */
export function errorReport(error: unknown): ErrorReport {
  if (!(error instanceof Error)) {
    return { name: 'NonError', frames: [] };
  }
  const frames = (error.stack ?? '').split('\n').filter((line) => FRAME.test(line));
  return { name: error.name, frames: frames.map((line) => line.trim()) };
}

/** El `ErrorHandler` de la aplicación: la consola de siempre, y además el puerto. */
@Injectable()
export class EwmsErrorHandler extends ErrorHandler {
  private readonly telemetry = inject(TELEMETRY);

  override handleError(error: unknown): void {
    super.handleError(error);
    this.telemetry.error(errorReport(error));
  }
}

/** El `ErrorHandler` de la aplicación; con `provideBrowserGlobalErrorListeners()` ve también lo no capturado. */
export function provideEwmsErrorHandling(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: ErrorHandler, useClass: EwmsErrorHandler }]);
}
