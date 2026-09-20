import { TestBed } from '@angular/core/testing';
import { SessionContext } from './session-context';

/**
 * The seat of the Security Core.
 *
 * There is almost nothing to test here, and that IS the test: what this class
 * has to be is a shape with signals in it, holding nothing that outlives the
 * tab, so that the App Shell can read credentials as DATA today and the
 * Security Core can fill them tomorrow without the layout changing.
 */
describe('SessionContext', () => {
  let session: SessionContext;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    session = TestBed.inject(SessionContext);
  });

  it('carries the synthetic company, warehouse and user the design draws', () => {
    // «ePrac / 0001 - CEDI_ePRAC» is data here, not text in a template, which
    // is the whole point of the seat existing before the backend does.
    expect(session.company().code).toBe('ePrac');
    expect(session.warehouse().code).toBe('0001');
    expect(session.warehouse().name).toBe('CEDI_ePRAC');
    expect(session.user().initials).toHaveLength(2);
  });

  it('switches warehouse WITHOUT anything resembling a re-authentication', () => {
    // PLN-WMS-001 §6's phase-0 criterion, in the only form available before
    // there is a backend: the state moves, and every consumer reads a signal.
    session.setWarehouse({ code: '0002', name: 'CEDI_NORTE' });

    expect(session.warehouse()).toEqual({ code: '0002', name: 'CEDI_NORTE' });
    // The company did not move with it: they are separate facts.
    expect(session.company().code).toBe('ePrac');
  });

  it('accepts a user, for the day the Security Core supplies one', () => {
    session.setUser({ name: 'Ana Rodríguez', initials: 'AR' });

    expect(session.user().name).toBe('Ana Rodríguez');
  });

  it('IS A SEAT AND NOT AUTHENTICATION: no token, no permissions, no login', () => {
    // Asserted rather than assumed, because the next person to touch this file
    // will be building the real thing and should find the boundary written
    // down. A token here before there is a backend would be an invented
    // contract.
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
