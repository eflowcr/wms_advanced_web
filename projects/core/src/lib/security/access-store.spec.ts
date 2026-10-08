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
          grants: { 'security.users:access': ['p'] },
          user: { id: 'u', name: 'User', active: true, version: 1, affiliation: 'internal' },
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
    expect(store.can('security.users:access')).toBe(false);
    expect(() => store.request('security.users:access')).toThrow(new SecurityError('denied'));
    expect(() => store.gateway).toThrow(new SecurityError('unavailable'));
    await store.refresh();
    expect(store.status()).toBe('error');
    await store.connect(gateway, actor, true);
    expect(store.demo()).toBe(true);
    expect(store.gateway).toBe(gateway);
    expect(store.request('security.users:access').actor).toEqual(actor);
    expect(() => store.request('security.users:export')).toThrow();
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
    expect(store.can('security.users:access')).toBe(false);
    await second;
    late({ grants: { 'security.users:access': ['p'] }, user: null });
    await first;
    expect(store.can('security.users:access')).toBe(false);
  });
  it('a re-read of the same context keeps grants and operations until the new grants arrive', async () => {
    await store.connect(gateway, actor);
    const signal = store.request('security.users:access').signal;
    const generation = store.generation();
    let answer: (result: AccessResult) => void = () => undefined;
    gateway.access = vi.fn(
      () =>
        new Promise<AccessResult>((resolve) => {
          answer = resolve;
        }),
    );
    listener();

    expect(store.status()).toBe('ready');
    expect(store.can('security.users:access')).toBe(true);
    expect(signal.aborted).toBe(false);
    answer({ grants: { 'security.users:update': ['p'] }, user: null });
    await vi.waitFor(() => expect(store.can('security.users:update')).toBe(true));

    expect(store.can('security.users:access')).toBe(false);
    expect(store.can('security.users:update')).toBe(true);
    expect(signal.aborted).toBe(false);
    expect(store.generation()).toBe(generation);
  });
  it('a context change empties, aborts operations and starts a new generation', async () => {
    await store.connect(gateway, actor);
    const signal = store.request('security.users:access').signal;
    const generation = store.generation();
    const changing = store.select({ ...actor, warehouseId: 'B', ownerId: 'Y' });

    expect(signal.aborted).toBe(true);
    expect(store.can('security.users:access')).toBe(false);
    expect(store.generation()).toBe(generation + 1);
    await changing;
  });
  it('a failed re-read closes everything and aborts operations', async () => {
    await store.connect(gateway, actor);
    const signal = store.request('security.users:access').signal;
    gateway.access = vi.fn().mockRejectedValue(new Error('offline'));
    await store.refresh();

    expect(store.status()).toBe('error');
    expect(store.can('security.users:access')).toBe(false);
    expect(signal.aborted).toBe(true);
    await store.connect(gateway, actor);
    await store.select(null);
    expect(() => store.request('security.users:access')).toThrow();
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
  it('joins refreshes requested during a read into one follow-up read', async () => {
    await store.connect(gateway, actor);
    expect(gateway.access).toHaveBeenCalledTimes(1);

    await Promise.all([store.refresh(), store.refresh(), store.refresh(), store.refresh()]);

    expect(gateway.access).toHaveBeenCalledTimes(3);
  });
  it('a write during an in-flight read ends with the new grants', async () => {
    await store.connect(gateway, actor);
    let stale: (result: AccessResult) => void = () => undefined;
    gateway.access = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<AccessResult>((resolve) => {
            stale = resolve;
          }),
      )
      .mockResolvedValue({ grants: { 'security.users:update': ['p'] }, user: null });
    const first = store.refresh();
    const afterWrite = store.refresh();
    stale({ grants: { 'security.users:access': ['p'] }, user: null });
    await Promise.all([first, afterWrite]);

    expect(gateway.access).toHaveBeenCalledTimes(2);
    expect(store.can('security.users:update')).toBe(true);
    expect(store.can('security.users:access')).toBe(false);
  });
  it('disconnecting at sign-out closes everything and lets the next session connect', async () => {
    const unsubscribe = vi.fn();
    gateway.subscribe = vi.fn(() => unsubscribe);
    await store.connect(gateway, actor, true);
    const signal = store.request('security.users:access').signal;
    store.disconnect();

    expect(signal.aborted).toBe(true);
    expect(unsubscribe).toHaveBeenCalled();
    expect(store.status()).toBe('idle');
    expect(store.actor()).toBeNull();
    expect(store.user()).toBeNull();
    expect(store.demo()).toBe(false);
    expect(store.can('security.users:access')).toBe(false);
    expect(() => store.gateway).toThrow(new SecurityError('unavailable'));
    await store.connect(gateway, actor);
    expect(store.can('security.users:access')).toBe(true);
  });
});
