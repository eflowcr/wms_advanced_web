import { Injectable, signal, type Signal } from '@angular/core';

/** Who is looking at the application. */
export interface SessionUser {
  readonly name: string;
  /** Short form for the avatar. Two letters at most. */
  readonly initials: string;
}

/** The customer the console is running for. */
export interface SessionCompany {
  readonly code: string;
  readonly name: string;
}

/** The warehouse the operator is working in right now (SEC-MUL-002). */
export interface SessionWarehouse {
  readonly code: string;
  readonly name: string;
}

/**
 * THE SEAT OF THE SECURITY CORE, AND NOTHING MORE THAN A SEAT.
 *
 * PLN-WMS-002 §5 asks for explicit shared state for the SESSION and the ACTIVE
 * WAREHOUSE from phase 0 of the product, and PLN-WMS-001 §6 puts *"a user
 * authenticates, switches active warehouse without authenticating again, and
 * sees their permissions recalculated at once"* in that phase's exit criteria.
 * None of that can be built yet: it depends on the backend's Security Core,
 * which starts in Sprint 1 (PLN-WMS-005 §5) and has not started.
 *
 * WHAT THIS IS: the shape of that state, with SYNTHETIC values, IN MEMORY, so
 * that the App Shell can draw the credentials block the design asks for
 * without inventing a place to keep them. «ePrac / 0001 - CEDI_ePRAC» is DATA
 * here, not text in a template -- which is the whole point. The day the
 * Security Core exists, this class is filled from it and NO LAYOUT CHANGES.
 *
 * WHAT THIS IS NOT: authentication. There is no token, no login, no guard and
 * no permission here, and adding one before there is a backend to answer would
 * be inventing a contract. ADR 0012 already reserved the route layer that a
 * guard will attach to.
 *
 * NOTHING IS PERSISTED. The same rule as everywhere else in this repository:
 * no browser storage, no exceptions (PLN-WMS-003 §4).
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
   * Switching warehouse WITHOUT re-authenticating is the phase-0 criterion
   * this seat exists for. It moves a signal today; when the Security Core
   * exists it will also ask the backend to recalculate permissions, and every
   * consumer already reads a signal, so no consumer changes.
   */
  setWarehouse(warehouse: SessionWarehouse): void {
    this.currentWarehouse.set(warehouse);
  }

  /** Filled by the Security Core when it exists. Synthetic until then. */
  setUser(user: SessionUser): void {
    this.currentUser.set(user);
  }
}
