import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SecurityError } from './access';
import { CoreSecurityGateway, SERVER_GRANT, toGrants } from './core-security-gateway';
import { SECURITY_API_URL } from './security-api-url';
import { ACCESS_QUERY } from './security-access.interceptor';

const BASE = '/api/v1/security';
const ACTOR = { userId: 'p-1', warehouseId: 'W1', ownerId: '' };

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SECURITY_API_URL, useValue: signal<string | undefined>(BASE) },
    ],
  });
  return {
    gateway: TestBed.inject(CoreSecurityGateway),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('CoreSecurityGateway (API Go)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('reads the effective permissions and grants each code from the session', async () => {
    const { gateway, http } = setup();
    const reading = gateway.access(ACTOR, new AbortController().signal);
    const request = http.expectOne(`${BASE}/security/effective-permissions`);
    expect(request.request.method).toBe('GET');
    expect(request.request.context.get(ACCESS_QUERY)).toBe(true);
    request.flush({ permissions: ['sec.users:read', 'inv.items:create'] });
    expect(await reading).toEqual({
      grants: { 'sec.users:read': [SERVER_GRANT], 'inv.items:create': [SERVER_GRANT] },
      user: null,
    });
    http.verify();
  });

  it('without a person there is nothing to ask', async () => {
    const { gateway, http } = setup();
    expect(await gateway.access(null, new AbortController().signal)).toEqual({
      grants: {},
      user: null,
    });
    http.verify();
  });

  it('a refusal from the API is denied; a failure is unavailable', async () => {
    const { gateway, http } = setup();
    for (const [status, code] of [
      [401, 'denied'],
      [403, 'denied'],
      [500, 'unavailable'],
    ] as const) {
      const reading = gateway.access(ACTOR, new AbortController().signal);
      http
        .expectOne(`${BASE}/security/effective-permissions`)
        .flush({ error: 'x', message: 'y' }, { status, statusText: 'Error' });
      await expect(reading).rejects.toEqual(new SecurityError(code));
    }
  });

  it('administration does not exist in the API yet: it is unavailable without a request', async () => {
    const { gateway, http } = setup();
    const request = { actor: ACTOR, signal: new AbortController().signal };
    await expect(gateway.snapshot()).rejects.toEqual(new SecurityError('unavailable'));
    await expect(gateway.users()).rejects.toEqual(new SecurityError('unavailable'));
    await expect(gateway.saveUser()).rejects.toEqual(new SecurityError('unavailable'));
    await expect(gateway.inspect()).rejects.toEqual(new SecurityError('unavailable'));
    await expect(gateway.saveProfile()).rejects.toEqual(new SecurityError('unavailable'));
    await expect(gateway.setAssignments()).rejects.toEqual(new SecurityError('unavailable'));
    await expect(gateway.setUserStatus()).rejects.toEqual(new SecurityError('unavailable'));
    expect(gateway.subscribe()()).toBeUndefined();
    expect(request.actor).toBe(ACTOR);
    http.verify();
  });

  it('an aborted read or a missing URL sends nothing', async () => {
    const { gateway, http } = setup();
    const aborted = new AbortController();
    aborted.abort();
    await expect(gateway.access(ACTOR, aborted.signal)).rejects.toEqual(new SecurityError('aborted'));
    (TestBed.inject(SECURITY_API_URL) as WritableSignal<string | undefined>).set(undefined);
    await expect(gateway.access(ACTOR, new AbortController().signal)).rejects.toEqual(
      new SecurityError('unavailable'),
    );
    http.verify();
  });

  it('a body without permissions grants nothing', async () => {
    const { gateway, http } = setup();
    const reading = gateway.access(ACTOR, new AbortController().signal);
    http.expectOne(`${BASE}/security/effective-permissions`).flush(null);
    expect(await reading).toEqual({ grants: {}, user: null });
  });

  it('ignores anything that is not a code', () => {
    expect(toGrants(null)).toEqual({});
    expect(toGrants(['a.b:c', 7 as unknown as string])).toEqual({ 'a.b:c': [SERVER_GRANT] });
  });
});
