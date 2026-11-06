import {
  capabilities,
  SecurityError,
  type Actor,
  type Profile,
  type SecurityRequest,
  type SecurityUser,
} from '@ewms/core/security';
import { MemorySecurityGateway, demoSnapshot } from './memory-gateway';

const actor: Actor = { userId: 'admin', warehouseId: 'A', ownerId: 'X' };
const newUser: SecurityUser = {
  id: 'new',
  name: 'New user',
  active: true,
  version: 0,
  affiliation: 'internal',
};
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
      gateway.saveUser(reader, { ...newUser }),
    ).rejects.toEqual(new SecurityError('denied'));
    const access = await gateway.access(reader.actor, reader.signal);
    expect(access.grants['security.users:export']).toBeUndefined();
    expect(access.grants['security.profiles:inspect']).toEqual(['read']);
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
        grants: [
          'security.profiles:access',
          'security.profiles:update',
          'security.profiles:assign',
          'security.profiles:inspect',
        ],
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
        grants: ['security.users:export'],
        version: 0,
      }),
    ).rejects.toEqual(new SecurityError('dependency'));
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
      new SecurityError('selfAssignment'),
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
    const row = { ...newUser };
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
      { ...newUser },
    );
    abort.abort();
    await expect(pending).rejects.toEqual(new SecurityError('aborted'));
    gateway.failNext('unavailable');
    await expect(gateway.users(request())).rejects.toEqual(new SecurityError('unavailable'));
    gateway.failNext('conflict');
    await expect(
      gateway.saveUser(request(), { ...newUser }),
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
      affiliation: 'internal',
    });
    await expect(
      gateway.saveUser(request({ ...actor, userId: 'operator' }), {
        id: 'unassigned',
        name: 'Outside scope',
        active: true,
        version: 1,
        affiliation: 'internal',
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
      'security.users:create': ['operate'],
    });
    expect(
      await gateway.inspect(request(), { userId: 'operator', warehouseId: 'B', ownerId: 'Y' }),
    ).not.toHaveProperty('security.users:create');
    await expect(gateway.inspect(request(), { ...actor, ownerId: 'Y' })).rejects.toEqual(
      new SecurityError('invalid'),
    );
    await expect(gateway.inspect(request({ ...actor, userId: 'operator' }), actor)).rejects.toEqual(
      new SecurityError('denied'),
    );
  });
  it('rejects any change to the assignments of the actor, even removing one (C6)', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const state = await gateway.snapshot(request());
    const own = state.assignments.filter((a) => a.userId === 'admin');
    await expect(
      gateway.setAssignments(request(), 'admin', own.slice(1), state.version),
    ).rejects.toEqual(new SecurityError('selfAssignment'));
    await expect(
      gateway.addAssignments(request(), [{ ...own[0]!, profileId: 'read' }], state.version),
    ).rejects.toEqual(new SecurityError('selfAssignment'));
  });
  it('rejects internal modules and other companies for an external user (C5)', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const scoped = request({ ...actor, warehouseId: 'B', ownerId: 'Y' });
    const state = await gateway.snapshot(scoped);
    const own = state.assignments.filter((a) => a.userId === 'external');
    expect(own.length).toBeGreaterThan(0);
    const add = (profileId: string, warehouseId: string, ownerId: string) =>
      gateway.setAssignments(
        scoped,
        'external',
        [...own, { userId: 'external', profileId, warehouseId, ownerId }],
        state.version,
      );
    await expect(add('read', 'B', 'Y')).rejects.toEqual(new SecurityError('externalAffiliation'));
    await expect(add('catalogs', 'A', 'X')).rejects.toEqual(
      new SecurityError('externalAffiliation'),
    );
    const user = (await gateway.users(scoped)).find((u) => u.id === 'reader')!;
    await expect(
      gateway.saveUser(scoped, { ...user, affiliation: 'external', companyId: 'Y' }),
    ).rejects.toEqual(new SecurityError('externalAffiliation'));
    await expect(
      gateway.saveUser(scoped, { ...newUser, affiliation: 'external', companyId: null }),
    ).rejects.toEqual(new SecurityError('invalid'));
    await expect(
      gateway.saveUser(scoped, { ...newUser, affiliation: 'internal', companyId: 'Y' }),
    ).rejects.toEqual(new SecurityError('invalid'));
    await gateway.saveUser(scoped, { ...newUser, affiliation: 'external', companyId: 'Y' });
  });
  it('rejects static segregation of duties naming the profiles in conflict', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const state = await gateway.snapshot(request());
    const own = state.assignments.filter((a) => a.userId === 'reader');
    const error = (await gateway
      .setAssignments(
        request(),
        'reader',
        [
          ...own,
          { userId: 'reader', profileId: 'admin', warehouseId: 'A', ownerId: 'X' },
          { userId: 'reader', profileId: 'audit', warehouseId: 'A', ownerId: 'X' },
        ],
        state.version,
      )
      .catch((e: unknown) => e)) as SecurityError;
    expect(error).toBeInstanceOf(SecurityError);
    expect(error.code).toBe('segregation');
    expect(error.conflicts).toEqual(['admin', 'audit']);
    // En contextos distintos no hay conflicto: la regla mira lo que una persona tiene a la vez.
    await gateway.setAssignments(
      request(),
      'reader',
      [
        ...own,
        { userId: 'reader', profileId: 'admin', warehouseId: 'B', ownerId: 'Y' },
        { userId: 'reader', profileId: 'audit', warehouseId: 'A', ownerId: 'X' },
      ],
      state.version,
    );
  });
  it('validates and honors the validity of an assignment', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const state = await gateway.snapshot(request());
    const row = { userId: 'operator', profileId: 'read', warehouseId: 'A', ownerId: 'X' };
    const others = state.assignments.filter(
      (a) => a.userId === 'operator' && a.warehouseId !== 'A',
    );
    for (const bad of [
      { validFrom: '2026-02-30' },
      { validUntil: 'tomorrow' },
      { validFrom: '2026-12-01', validUntil: '2026-11-01' },
    ])
      await expect(
        gateway.setAssignments(
          request(),
          'operator',
          [...others, { ...row, ...bad }],
          state.version,
        ),
      ).rejects.toEqual(new SecurityError('invalid'));
    await gateway.setAssignments(
      request(),
      'operator',
      [...others, { ...row, validUntil: '2000-01-01' }],
      state.version,
    );
    const operator = { userId: 'operator', warehouseId: 'A', ownerId: 'X' };
    expect((await gateway.access(operator, new AbortController().signal)).grants).toEqual({});
  });
  it('adds a bulk assignment as explicit rows, all or none', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    const state = await gateway.snapshot(request());
    const rows = ['reader', 'operator'].map((userId) => ({
      userId,
      profileId: 'audit',
      warehouseId: 'A',
      ownerId: 'X',
      validUntil: '2999-12-31',
    }));
    const listener = vi.fn();
    gateway.subscribe(listener);
    await expect(
      gateway.addAssignments(request(), [...rows, rows[0]!], state.version),
    ).rejects.toEqual(new SecurityError('duplicate'));
    await expect(gateway.addAssignments(request(), [], state.version)).rejects.toEqual(
      new SecurityError('invalid'),
    );
    await expect(
      gateway.addAssignments(request({ ...actor, userId: 'reader' }), rows, state.version),
    ).rejects.toEqual(new SecurityError('denied'));
    expect(listener).not.toHaveBeenCalled();
    await gateway.addAssignments(request(), rows, state.version);
    const saved = await gateway.snapshot(request());
    expect(saved.assignments.filter((a) => a.profileId === 'audit')).toEqual(rows);
    await expect(gateway.addAssignments(request(), rows, saved.version)).rejects.toEqual(
      new SecurityError('duplicate'),
    );
    await expect(gateway.addAssignments(request(), rows, state.version)).rejects.toEqual(
      new SecurityError('conflict'),
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('runs an access review: author and date per decision, revocation removes the row', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    await expect(
      gateway.startReview(request({ ...actor, userId: 'reader' }), {
        name: 'Q4',
        dueDate: '2026-12-31',
      }),
    ).rejects.toEqual(new SecurityError('denied'));
    await expect(
      gateway.startReview(request(), { name: 'Q4', dueDate: '2026-02-30' }),
    ).rejects.toEqual(new SecurityError('invalid'));
    await gateway.startReview(request(), { name: 'Q4', dueDate: '2026-12-31' });
    let [campaign] = await gateway.reviews(request());
    expect(campaign).toMatchObject({ name: 'Q4', dueDate: '2026-12-31', version: 1 });
    // Solo lo vigente y lo que quien revisa puede decidir: A/X para quien revisa en A/X.
    expect(campaign!.items.every((i) => i.decision === null)).toBe(true);
    expect(campaign!.items.length).toBeGreaterThan(0);
    const reader = campaign!.items.find((i) => i.userId === 'reader' && i.warehouseId === 'A')!;
    const own = campaign!.items.find((i) => i.userId === 'admin')!;
    await expect(gateway.decide(request(), campaign!.id, own, 'confirm', 1)).rejects.toEqual(
      new SecurityError('selfAssignment'),
    );
    await gateway.decide(request(), campaign!.id, reader, 'revoke', 1);
    await expect(gateway.decide(request(), campaign!.id, reader, 'confirm', 1)).rejects.toEqual(
      new SecurityError('conflict'),
    );
    [campaign] = await gateway.reviews(request());
    expect(campaign!.items.find((i) => i.userId === 'reader' && i.warehouseId === 'A')).toMatchObject({
      decision: 'revoke',
      decidedBy: 'admin',
    });
    expect(campaign!.version).toBe(2);
    const state = await gateway.snapshot(request());
    expect(state.assignments.some((a) => a.userId === 'reader' && a.warehouseId === 'A')).toBe(
      false,
    );
    const operator = campaign!.items.find((i) => i.userId === 'operator')!;
    await gateway.decide(request(), campaign!.id, operator, 'confirm', 2);
    [campaign] = await gateway.reviews(request());
    expect(campaign!.items.find((i) => i.userId === 'operator')?.decidedAt).toMatch(/^\d{4}-/);
    expect((await gateway.snapshot(request())).assignments).toContainEqual(
      expect.objectContaining({ userId: 'operator', profileId: operator.profileId }),
    );
  });
  it('keeps the review of a context away from who cannot review it', async () => {
    const gateway = new MemorySecurityGateway({ latency: 0 });
    await gateway.startReview(request(), { name: 'Q4', dueDate: '2026-12-31' });
    await expect(gateway.reviews(request({ ...actor, userId: 'operator' }))).rejects.toEqual(
      new SecurityError('denied'),
    );
  });
});
