import type { AccessContext } from './access';

/** Por qué el servidor no cambió el almacén activo; la pantalla lo traduce. */
export type ContextChangeCode = 'taskInProgress' | 'denied' | 'unavailable';
export class ContextChangeError extends Error {
  constructor(readonly code: ContextChangeCode) {
    super(code);
  }
}

/**
 * Puerto del almacén activo (SEC-MUL-003): la sesión del servidor es la única fuente y el cambio
 * lo decide el servidor. El shell provee el adaptador de su modo en el área autenticada (ADR 0028).
 */
export abstract class ActiveContext {
  /** Los contextos con asignación vigente de quien abrió la sesión; ninguno si no cargan. */
  abstract contexts(): Promise<readonly AccessContext[]>;
  /** Cambia el almacén activo sin volver a iniciar sesión; la sesión adopta la respuesta. */
  abstract switchTo(context: AccessContext): Promise<void>;
}
