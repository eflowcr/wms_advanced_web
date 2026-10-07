import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AccessStore } from './access-store';
import { accessGuard } from './access-guard';
import { SecurityError, type AccessResult, type SecurityGateway } from './access';

describe('AccessStore', () => {
  const actor = { userId: 'u', warehouseId: 'A', ownerId: 'X' };
  let store: AccessStore;
  let listener: () => void;
  let gateway: SecurityGateway;
  const redirect = {};
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree: vi.fn().mockReturnValue(redirect) } },
      ],
    });
    store = TestBed.inject(AccessStore);
    gateway = {
      access: vi
        .fn()
        .mockResolvedValue({
          grants: { 'users.view': ['p'] },
          user: { id: 'u', name: 'User', active: true, version: 1 },
        }),
      snapshot: vi.fn(),
      inspect: vi.fn(),
      users: vi.fn(),
      saveProfile: vi.fn(),
      saveUser: vi.fn(),
      setAssignments: vi.fn(),
      setUserStatus: vi.fn(),
      subscribe: vi.fn((next) => {
        listener = next;
        return vi.fn();
      }),
    };
  });
  it('starts closed and requires available identity for direct execution', async () => {
    expect(store.can('users.view')).toBe(false);
    expect(() => store.request('users.view')).toThrow(new SecurityError('denied'));
    expect(() => store.gateway).toThrow(new SecurityError('unavailable'));
    await store.refresh();
    expect(store.status()).toBe('error');
    await store.connect(gateway, actor, true);
    expect(store.demo()).toBe(true);
    expect(store.gateway).toBe(gateway);
    expect(store.request('users.view').actor).toEqual(actor);
    expect(() => store.request('users.export')).toThrow();
    expect(store.canRoute('/configuracion/usuarios?x=1')).toBe(true);
    expect(store.canRoute('/configuracion/usuarios/1')).toBe(true);
    expect(store.canRoute('/configuracion/perfiles')).toBe(false);
    expect(store.canRoute('/unknown')).toBe(false);
    expect(store.canRoute('/')).toBe(true);
    expect(store.canRoute('/design-system')).toBe(true);
    expect(store.canRoute('/design-system/button')).toBe(true);
  });
  it('clears grants immediately and discards a late response from the previous context', async () => {
    let late: (result: AccessResult) => void = () => undefined;
    gateway.access = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AccessResult>((resolve) => {
            late = resolve;
          }),
      )
      .mockResolvedValue({ grants: {}, user: null });
    const first = store.connect(gateway, actor);
    const second = store.select({ ...actor, warehouseId: 'B', ownerId: 'Y' });
    expect(store.status()).toBe('loading');
    expect(store.can('users.view')).toBe(false);
    await second;
    late({ grants: { 'users.view': ['p'] }, user: null });
    await first;
    expect(store.can('users.view')).toBe(false);
  });
  it('aborts pending writes, reacts to revocation and remains closed on failure', async () => {
    await store.connect(gateway, actor);
    const signal = store.request('users.view').signal;
    gateway.access = vi.fn().mockResolvedValue({ grants: {}, user: null });
    listener();
    expect(signal.aborted).toBe(true);
    expect(store.can('users.view')).toBe(false);
    await Promise.resolve();
    gateway.access = vi.fn().mockRejectedValue(new Error('offline'));
    await store.refresh();
    expect(store.status()).toBe('error');
    await store.connect(gateway, actor);
    await store.select(null);
    expect(() => store.request('users.view')).toThrow();
  });
  it('ignores a rejected stale read and a guard redirects without retrying writes', async () => {
    let reject: (reason: Error) => void = () => undefined;
    gateway.access = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue({ grants: {}, user: null });
    const first = store.connect(gateway, actor);
    await store.select(null);
    reject(new Error('stale'));
    await first;
    expect(store.status()).toBe('ready');
    expect(
      await TestBed.runInInjectionContext(() =>
        accessGuard({} as never, { url: '/configuracion/usuarios' } as never),
      ),
    ).toBe(redirect);
    expect(
      await TestBed.runInInjectionContext(() => accessGuard({} as never, { url: '/' } as never)),
    ).toBe(true);
  });
});
