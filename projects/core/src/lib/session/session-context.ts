import { Injectable, signal, type Signal } from '@angular/core';

/** Quién está usando la aplicación. */
export interface SessionUser {
  readonly name: string;
  /** Para el avatar; dos letras como máximo. */
  readonly initials: string;
}

/** El cliente para el que corre la consola. */
export interface SessionCompany {
  readonly code: string;
  readonly name: string;
}

/** El almacén donde trabaja ahora el operario (SEC-MUL-002). */
export interface SessionWarehouse {
  readonly code: string;
  readonly name: string;
}

/**
 * Asiento del Security Core: el estado de sesión y almacén activo de PLN-WMS-002 §5, sintético,
 * en memoria y sin persistir (PLN-WMS-003 §4). No es autenticación: ni token ni login ni guard
 * hasta que haya backend. Ver vault: 08-Sistema-de-Diseno/Componentes/App-Shell.
 */
@Injectable({ providedIn: 'root' })
export class SessionContext {
  private readonly currentUser = signal<SessionUser>({ name: 'Operador', initials: 'OP' });
  private readonly currentCompany = signal<SessionCompany>({ code: 'ePrac', name: 'ePRAC' });
  private readonly currentWarehouse = signal<SessionWarehouse>({
    code: '0001',
    name: 'CEDI_ePRAC',
  });

  readonly user: Signal<SessionUser> = this.currentUser.asReadonly();
  readonly company: Signal<SessionCompany> = this.currentCompany.asReadonly();
  readonly warehouse: Signal<SessionWarehouse> = this.currentWarehouse.asReadonly();

  /**
   * Cambiar de almacén sin reautenticarse es el criterio de fase 0 (PLN-WMS-001 §6). Hoy mueve
   * una signal; con Security Core también pedirá recalcular permisos, sin tocar consumidores.
   */
  setWarehouse(warehouse: SessionWarehouse): void {
    this.currentWarehouse.set(warehouse);
  }

  /** Lo llenará el Security Core; sintético hasta entonces. */
  setUser(user: SessionUser): void {
    this.currentUser.set(user);
  }
}
