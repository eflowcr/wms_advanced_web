import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ContextChangeError } from './active-context';
import { AuthSession, type SessionGrant, type SessionInfo } from './auth-session';
import { CoreActiveContext } from './core-active-context';
import { SECURITY_API_URL } from './security-api-url';

const BASE = '/api/v1/security';
const SESSION: SessionInfo = { userId: 'p-1', name: 'Ana', warehouseId: 'W1', ownerId: '' };

function setup() {
  const adopt = vi.fn<(grant: SessionGrant) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: SECURITY_API_URL, useValue: signal<string | undefined>(BASE) },
      {
        provide: AuthSession,
        useValue: { session: signal(SESSION), token: () => 'acc-1', adopt },
      },
    ],
  });
  return {
    context: TestBed.inject(CoreActiveContext),
    http: TestBed.inject(HttpTestingController),
    adopt,
  };
}

describe('CoreActiveContext (API Go)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lists the warehouses the API allows', async () => {
    const { context, http } = setup();
    const listing = context.contexts();
    http.expectOne(`${BASE}/auth/contexts`).flush([
      { warehouse_id: 'W1', owner_id: 'O1' },
      { warehouse_id: 'W2' },
      { nothing: true },
    ]);
    expect(await listing).toEqual([
      { warehouseId: 'W1', ownerId: 'O1' },
      { warehouseId: 'W2', ownerId: '' },
    ]);
  });

  it('without the list the selector stays closed', async () => {
    const { context, http } = setup();
    const listing = context.contexts();
    http.expectOne(`${BASE}/auth/contexts`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await listing).toEqual([]);
  });

  it('switches on /auth/switch-warehouse and the session adopts the answer', async () => {
    const { context, http, adopt } = setup();
    const switching = context.switchTo({ warehouseId: 'W2', ownerId: 'O2' });
    const request = http.expectOne(`${BASE}/auth/switch-warehouse`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ target_warehouse_id: 'W2' });
    request.flush({ session_id: 's-1', active_warehouse_id: 'W2' });
    await switching;
    expect(adopt).toHaveBeenCalledWith({
      accessToken: 'acc-1',
      session: { ...SESSION, warehouseId: 'W2', ownerId: 'O2' },
    });
  });

  it('without URL or session nothing leaves, and odd answers are tolerated', async () => {
    const { context, http, adopt } = setup();
    const listing = context.contexts();
    http.expectOne(`${BASE}/auth/contexts`).flush({ not: 'a list' });
    expect(await listing).toEqual([]);
    const switching = context.switchTo({ warehouseId: 'W3', ownerId: '' });
    http.expectOne(`${BASE}/auth/switch-warehouse`).flush(null);
    await switching;
    expect(adopt).toHaveBeenCalledWith({
      accessToken: 'acc-1',
      session: { ...SESSION, warehouseId: 'W3', ownerId: '' },
    });
    (TestBed.inject(SECURITY_API_URL) as WritableSignal<string | undefined>).set(undefined);
    expect(await context.contexts()).toEqual([]);
    await expect(context.switchTo({ warehouseId: 'W2', ownerId: '' })).rejects.toEqual(
      new ContextChangeError('unavailable'),
    );
    http.verify();
  });

  it('translates the refusals', async () => {
    const { context, http, adopt } = setup();
    for (const [status, code] of [
      [400, 'denied'],
      [403, 'denied'],
      [409, 'taskInProgress'],
      [500, 'unavailable'],
    ] as const) {
      const switching = context.switchTo({ warehouseId: 'W2', ownerId: '' });
      http
        .expectOne(`${BASE}/auth/switch-warehouse`)
        .flush({ error: 'switch_failed' }, { status, statusText: 'Error' });
      await expect(switching).rejects.toEqual(new ContextChangeError(code));
    }
    expect(adopt).not.toHaveBeenCalled();
  });
});
