import {
  SecurityError,
  type Actor,
  type Assignment,
  type SecurityRequest,
  type SecuritySnapshot,
} from '@ewms/core/security';
import { MemorySecurityGateway, demoSnapshot } from './memory-gateway';

const admin: Actor = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
const request = (actor = admin, signal = new AbortController().signal): SecurityRequest => ({
  actor,
  signal,
});
const aborted = (): AbortSignal => {
  const controller = new AbortController();
  controller.abort();
  return controller.signal;
};
const fails = (code: string) => expect.objectContaining({ code });

/** El administrador solo administra A/X: en B/Y no tiene autoridad que delegar. */
function adminOnlyInA(): SecuritySnapshot {
  const state = demoSnapshot();
  return {
    ...state,
    users: [
      ...state.users,
      { id: 'loner', name: 'Sin asignaciones', active: true, version: 1, affiliation: 'internal' },
    ],
    assignments: state.assignments.filter((a) => a.userId !== 'admin' || a.warehouseId === 'A'),
  };
}
const inB: Assignment = { userId: 'reader', profileId: 'catalogs', warehouseId: 'B', ownerId: 'Y' };

describe('MemorySecurityGateway, the contract rejections', () => {
  it('without options waits like a server, and an aborted request never reaches the state', async () => {
    const gateway = new MemorySecurityGateway();
    await expect(gateway.users(request(admin, aborted()))).rejects.toEqual(fails('aborted'));
    expect((await new MemorySecurityGateway({ latency: 0 }).access(null, aborted()).catch((e) => e)).code).toBe(
      'aborted',
    );
    expect((await new MemorySecurityGateway({ latency: 0 }).access(null, new AbortController().signal)).user).toBeNull();
  });

  it('inspects only known people and contexts, and only where the actor may inspect', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0, state: adminOnlyInA() });
    await expect(
      gateway.inspect(request(), { userId: 'reader', warehouseId: 'Z', ownerId: 'Z' }),
    ).rejects.toEqual(fails('invalid'));
    await expect(
      gateway.inspect(request(), { userId: 'nobody', warehouseId: 'A', ownerId: 'X' }),
    ).rejects.toEqual(fails('invalid'));
    await expect(
      gateway.inspect(request(), { userId: 'reader', warehouseId: 'B', ownerId: 'Y' }),
    ).rejects.toEqual(fails('delegation'));
  });

  it('a profile keeps a unique name, distinct known grants and each action with its screen', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const profile = { id: 'fresh', name: 'Fresh', grants: ['general.dashboard:access'], version: 0 };
    await expect(gateway.saveProfile(request(), { ...profile, name: ' administrator ' })).rejects.toEqual(
      fails('duplicate'),
    );
    await expect(
      gateway.saveProfile(request(), { ...profile, grants: ['general.dashboard:access', 'general.dashboard:access'] }),
    ).rejects.toEqual(fails('invalid'));
    await expect(
      gateway.saveProfile(request(), { ...profile, grants: ['security.users:export'] }),
    ).rejects.toEqual(fails('dependency'));
    await expect(gateway.saveProfile(request(), { ...profile, name: 'x' })).rejects.toEqual(fails('invalid'));
    await expect(gateway.saveProfile(request(), { ...profile, id: 'bad id' })).rejects.toEqual(fails('invalid'));
  });

  it('assignments: never for the actor, the current version, no repeats, real rows and own authority', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0, state: adminOnlyInA() });
    const version = (await gateway.snapshot(request())).version;
    const saved = demoSnapshot().assignments.filter((a) => a.userId === 'reader' && a.warehouseId === 'A');
    await expect(gateway.setAssignments(request(), 'admin', [], version)).rejects.toEqual(
      fails('selfAssignment'),
    );
    await expect(gateway.setAssignments(request(), 'reader', saved, version + 1)).rejects.toEqual(
      fails('conflict'),
    );
    await expect(
      gateway.setAssignments(request(), 'reader', [...saved, ...saved], version),
    ).rejects.toEqual(fails('duplicate'));
    await expect(
      gateway.setAssignments(request(), 'reader', [{ ...saved[0]!, validFrom: '2026-02-30' }], version),
    ).rejects.toEqual(fails('invalid'));
    await expect(gateway.setAssignments(request(), 'reader', [...saved, inB], version)).rejects.toEqual(
      fails('delegation'),
    );
  });

  it('bulk rows: something to add, nobody assigns themselves, known people, no repeats, own authority', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0, state: adminOnlyInA() });
    const version = (await gateway.snapshot(request())).version;
    const row: Assignment = { userId: 'loner', profileId: 'read', warehouseId: 'A', ownerId: 'X' };
    await expect(gateway.addAssignments(request(), [], version)).rejects.toEqual(fails('invalid'));
    await expect(gateway.addAssignments(request(), [{ ...row, userId: 'admin' }], version)).rejects.toEqual(
      fails('selfAssignment'),
    );
    await expect(gateway.addAssignments(request(), [{ ...row, userId: 'nobody' }], version)).rejects.toEqual(
      fails('invalid'),
    );
    await expect(
      gateway.addAssignments(request(), [{ ...row, userId: 'reader' }], version),
    ).rejects.toEqual(fails('duplicate'));
    await expect(gateway.addAssignments(request(), [{ ...inB, userId: 'loner' }], version)).rejects.toEqual(
      fails('delegation'),
    );
    expect((await gateway.users(request())).some((u) => u.id === 'loner')).toBe(false);
    // Sin administrador en B/Y, ningún estado nuevo se guarda: siempre queda uno por contexto.
    await expect(gateway.addAssignments(request(), [row], version)).rejects.toEqual(fails('lastAdmin'));
  });

  it('a review needs a real due date and something in force, and each item is decided once', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    await expect(gateway.startReview(request(), { name: 'Q4', dueDate: '2999-02-30' })).rejects.toEqual(
      fails('invalid'),
    );
    await gateway.startReview(request(), { name: 'Q4', dueDate: '2999-12-31' });
    const [campaign] = await gateway.reviews(request());
    const item = campaign!.items.find((i) => i.userId === 'reader')!;
    await expect(gateway.decide(request(), 'none', item, 'confirm', 1)).rejects.toEqual(fails('invalid'));
    await expect(
      gateway.decide(request(), campaign!.id, item, 'maybe' as never, 1),
    ).rejects.toEqual(fails('invalid'));
    const own = campaign!.items.find((i) => i.userId === 'admin')!;
    await expect(gateway.decide(request(), campaign!.id, own, 'confirm', 1)).rejects.toEqual(
      fails('selfAssignment'),
    );
    await expect(
      gateway.decide(request(), campaign!.id, { ...item, profileId: 'audit' }, 'confirm', 1),
    ).rejects.toEqual(fails('invalid'));
    await gateway.decide(request(), campaign!.id, item, 'confirm', 1);
    await expect(gateway.decide(request(), campaign!.id, item, 'revoke', 2)).rejects.toEqual(
      fails('conflict'),
    );
  });

  it('a user keeps a valid name, id, state and affiliation, and is edited only with authority', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0, state: adminOnlyInA() });
    const user = { id: 'nuevo', name: 'Nueva', active: true, version: 0, affiliation: 'internal' as const };
    await expect(gateway.saveUser(request(), { ...user, version: 3 })).rejects.toEqual(fails('conflict'));
    await expect(gateway.saveUser(request(), { ...user, name: ' ' })).rejects.toEqual(fails('invalid'));
    await expect(gateway.saveUser(request(), { ...user, id: '../x' })).rejects.toEqual(fails('invalid'));
    await expect(gateway.saveUser(request(), { ...user, active: 'yes' as never })).rejects.toEqual(
      fails('invalid'),
    );
    await expect(gateway.saveUser(request(), { ...user, affiliation: 'external' })).rejects.toEqual(
      fails('invalid'),
    );
    await expect(gateway.saveUser(request(), { ...user, companyId: 'X' })).rejects.toEqual(
      fails('invalid'),
    );
    const reader = (await gateway.users(request())).find((u) => u.id === 'reader')!;
    await expect(gateway.saveUser(request(), { ...reader, active: false })).rejects.toEqual(
      fails('invalid'),
    );
    await expect(gateway.saveUser(request(), { ...reader, name: 'Rosa C.' })).rejects.toEqual(
      fails('delegation'),
    );
    await expect(gateway.setUserStatus(request(), 'nobody', false, 1)).rejects.toEqual(fails('invalid'));
    await expect(gateway.setUserStatus(request(), 'reader', 'no' as never, 1)).rejects.toEqual(
      fails('invalid'),
    );
  });

  it('nobody widens their own access, not even through a profile they administer', async () => {
    const state = demoSnapshot();
    const gateway = new MemorySecurityGateway({
      latency: 0,
      state: {
        ...state,
        profiles: [
          ...state.profiles,
          {
            id: 'editor',
            name: 'Profile editor',
            grants: ['general.dashboard:access', 'security.profiles:access', 'security.profiles:update'],
            version: 1,
          },
        ],
        assignments: [
          ...state.assignments,
          { userId: 'operator', profileId: 'editor', warehouseId: 'A', ownerId: 'X' },
        ],
      },
    });
    const operator = request({ ...admin, userId: 'operator' });
    await expect(
      gateway.saveProfile(operator, {
        id: 'editor',
        name: 'Profile editor',
        grants: [
          'general.dashboard:access',
          'security.profiles:access',
          'security.profiles:update',
          'security.users:access',
          'security.users:export',
        ],
        version: 1,
      }),
    ).rejects.toEqual(new SecurityError('delegation'));
    const fresh = new MemorySecurityGateway({ latency: 0 });
    const signal = new AbortController();
    const write = fresh.saveUser(request(admin, signal.signal), {
      id: 'late',
      name: 'Tarde',
      active: true,
      version: 0,
      affiliation: 'internal',
    });
    signal.abort();
    await expect(write).rejects.toEqual(fails('aborted'));
  });
});
