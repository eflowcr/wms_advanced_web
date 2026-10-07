import {
  capabilities,
  SecurityError,
  type Actor,
  type Profile,
  type SecurityRequest,
} from '@ewms/core/security';
import { MemorySecurityGateway, demoSnapshot } from './memory-gateway';

const actor: Actor = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
const request = (value = actor): SecurityRequest => ({
  actor: value,
  signal: new AbortController().signal,
});

describe('MemorySecurityGateway', () => {
  it('separates consultation, creation, status and export', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const reader = request({ ...actor, userId: 'reader' });
    expect((await gateway.users(reader)).length).toBeGreaterThan(0);
    await expect(
      gateway.saveUser(reader, { id: 'new', name: 'New user', active: true, version: 0 }),
    ).rejects.toEqual(new SecurityError('denied'));
    const access = await gateway.access(reader.actor, reader.signal);
    expect(access.grants['users.export']).toBeUndefined();
    expect(access.grants['profiles.inspect']).toEqual(['read']);
  });
  it('rejects administrative delegation outside actor authority and invalid contexts', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const row: Profile = { id: 'new', name: 'New profile', grants: capabilities(), version: 0 };
    await expect(gateway.saveProfile(request({ ...actor, userId: 'reader' }), row)).rejects.toEqual(
      new SecurityError('denied'),
    );
    await expect(
      gateway.setAssignments(
        request(),
        'reader',
        [{ userId: 'reader', profileId: 'read', warehouseId: 'A', ownerId: 'Y' }],
        1,
      ),
    ).rejects.toEqual(new SecurityError('invalid'));
    const state = demoSnapshot();
    const profiles = [
      ...state.profiles,
      {
        id: 'manager',
        name: 'Manager',
        grants: ['profiles.view', 'profiles.manage', 'profiles.assign', 'profiles.inspect'],
        version: 1,
      },
    ];
    const assignments = [
      ...state.assignments,
      { userId: 'reader', profileId: 'manager', warehouseId: 'A', ownerId: 'X' },
    ];
    const partial = new MemorySecurityGateway({
      latency: 0,
      state: { ...state, profiles, assignments },
    });
    await expect(partial.saveProfile(request({ ...actor, userId: 'reader' }), row)).rejects.toEqual(
      new SecurityError('delegation'),
    );
  });
  it('rejects self escalation, duplicates and contradictory grants', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const state = await gateway.snapshot(request());
    const own = state.assignments.filter((a) => a.userId === 'reader');
    await expect(
      gateway.setAssignments(request({ ...actor, userId: 'reader' }), 'reader', own, state.version),
    ).rejects.toEqual(new SecurityError('denied'));
    await expect(
      gateway.setAssignments(request(), 'reader', [...own, own[0]!], state.version),
    ).rejects.toEqual(new SecurityError('duplicate'));
    await expect(
      gateway.saveProfile(request(), {
        id: 'new',
        name: 'New profile',
        grants: ['users.export'],
        version: 0,
      }),
    ).rejects.toEqual(new SecurityError('invalid'));
    await expect(
      gateway.saveProfile(request(), { id: 'new', name: 'Administrator', grants: [], version: 0 }),
    ).rejects.toEqual(new SecurityError('duplicate'));
  });
  it('preserves the last authorized administrator of every scope', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    await expect(gateway.setUserStatus(request(), 'admin', false, 1)).rejects.toEqual(
      new SecurityError('lastAdmin'),
    );
    const state = await gateway.snapshot(request());
    await expect(gateway.setAssignments(request(), 'admin', [], state.version)).rejects.toEqual(
      new SecurityError('lastAdmin'),
    );
    const profile = state.profiles.find((p) => p.id === 'admin')!;
    await expect(gateway.saveProfile(request(), { ...profile, grants: [] })).rejects.toEqual(
      new SecurityError('lastAdmin'),
    );
  });
  it('checks versions and does not silently overwrite', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const state = await gateway.snapshot(request());
    const profile = state.profiles.find((p) => p.id === 'read')!;
    await gateway.saveProfile(request(), { ...profile, name: 'Changed' });
    await expect(gateway.saveProfile(request(), { ...profile, name: 'Stale' })).rejects.toEqual(
      new SecurityError('conflict'),
    );
    expect((await gateway.snapshot(request())).profiles.find((p) => p.id === 'read')?.name).toBe(
      'Changed',
    );
  });
  it('rejects a concurrent stale user edit and a duplicate stable identifier', async () => {
    const gateway = new MemorySecurityGateway({ latency: 5 });
    const user = (await gateway.users(request())).find((u) => u.id === 'reader')!;
    const edits = await Promise.allSettled([
      gateway.saveUser(request(), { ...user, name: 'First' }),
      gateway.saveUser(request(), { ...user, name: 'Second' }),
    ]);
    expect(edits.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = { id: 'new', name: 'New user', active: true, version: 0 };
    const creates = await Promise.allSettled([
      gateway.saveUser(request(), row),
      gateway.saveUser(request(), row),
    ]);
    expect(creates.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
  it('aborts late reads and writes, injects deterministic failure and conflict', async () => {
    const gateway = new MemorySecurityGateway({ latency: 5 });
    const abort = new AbortController();
    const pending = gateway.saveUser(
      { actor, signal: abort.signal },
      { id: 'new', name: 'New user', active: true, version: 0 },
    );
    abort.abort();
    await expect(pending).rejects.toEqual(new SecurityError('aborted'));
    gateway.failNext('unavailable');
    await expect(gateway.users(request())).rejects.toEqual(new SecurityError('unavailable'));
    gateway.failNext('conflict');
    await expect(
      gateway.saveUser(request(), { id: 'new', name: 'New user', active: true, version: 0 }),
    ).rejects.toEqual(new SecurityError('conflict'));
    expect((await gateway.users(request())).some((u) => u.id === 'new')).toBe(false);
  });
  it('protects the creation scope of a user without assignments', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    await gateway.saveUser(request({ ...actor, warehouseId: 'B', ownerId: 'Y' }), {
      id: 'unassigned',
      name: 'Scoped user',
      active: true,
      version: 0,
    });
    await expect(
      gateway.saveUser(request({ ...actor, userId: 'operator' }), {
        id: 'unassigned',
        name: 'Outside scope',
        active: true,
        version: 1,
      }),
    ).rejects.toEqual(new SecurityError('delegation'));
  });
  it('preserves assignments in contexts outside a scoped administrator authority', async () => {
    const state = demoSnapshot();
    const profiles = [
      ...state.profiles,
      { ...state.profiles[0]!, id: 'scoped', name: 'Scoped manager' },
    ];
    const assignments = [
      ...state.assignments,
      { userId: 'reader', profileId: 'scoped', warehouseId: 'A', ownerId: 'X' },
    ];
    const gateway = new MemorySecurityGateway({
      latency: 0,
      state: { ...state, profiles, assignments },
    });
    const scoped = request({ ...actor, userId: 'reader' });
    await gateway.setAssignments(
      scoped,
      'operator',
      [{ userId: 'operator', profileId: 'read', warehouseId: 'A', ownerId: 'X' }],
      state.version,
    );
    const result = await gateway.snapshot(request());
    expect(
      result.assignments.filter((a) => a.userId === 'operator' && a.warehouseId === 'B'),
    ).toEqual(state.assignments.filter((a) => a.userId === 'operator' && a.warehouseId === 'B'));
  });
  it('authorizes inspection in the target context and returns saved provenance', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    expect(await gateway.inspect(request(), { ...actor, userId: 'operator' })).toMatchObject({
      'users.create': ['operate'],
    });
    expect(
      await gateway.inspect(request(), { userId: 'operator', warehouseId: 'B', ownerId: 'Y' }),
    ).not.toHaveProperty('users.create');
    await expect(gateway.inspect(request(), { ...actor, ownerId: 'Y' })).rejects.toEqual(
      new SecurityError('invalid'),
    );
    await expect(gateway.inspect(request({ ...actor, userId: 'operator' }), actor)).rejects.toEqual(
      new SecurityError('denied'),
    );
  });
});
