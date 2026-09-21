import { TestBed } from '@angular/core/testing';
import { SessionContext } from './session-context';

/** Casi no hay qué probar, y esa es la prueba: signals que no sobreviven a la pestaña. */
describe('SessionContext', () => {
  let session: SessionContext;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    session = TestBed.inject(SessionContext);
  });

  it('carries the synthetic company, warehouse and user the design draws', () => {
    // «ePrac / 0001 - CEDI_ePRAC» es dato, no texto en una plantilla.
    expect(session.company().code).toBe('ePrac');
    expect(session.warehouse().code).toBe('0001');
    expect(session.warehouse().name).toBe('CEDI_ePRAC');
    expect(session.user().initials).toHaveLength(2);
  });

  it('switches warehouse WITHOUT anything resembling a re-authentication', () => {
    // Criterio de fase 0 de PLN-WMS-001 §6, en la única forma posible sin backend.
    session.setWarehouse({ code: '0002', name: 'CEDI_NORTE' });

    expect(session.warehouse()).toEqual({ code: '0002', name: 'CEDI_NORTE' });
    // La empresa no se movió: son hechos separados.
    expect(session.company().code).toBe('ePrac');
  });

  it('accepts a user, for the day the Security Core supplies one', () => {
    session.setUser({ name: 'Ana Rodríguez', initials: 'AR' });

    expect(session.user().name).toBe('Ana Rodríguez');
  });

  it('IS A SEAT AND NOT AUTHENTICATION: no token, no permissions, no login', () => {
    // Afirmado y no supuesto: un token antes de que haya backend sería un contrato inventado.
    const surface = Object.keys(Object.getPrototypeOf(session) as object).concat(
      Object.keys(session),
    );

    expect(surface.some((name) => /token|permission|login|auth/i.test(name))).toBe(false);
  });

  it('persists nothing: a fresh injector starts from the synthetic values', () => {
    session.setWarehouse({ code: '0009', name: 'OTRO' });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    expect(TestBed.inject(SessionContext).warehouse().code).toBe('0001');
  });
});
