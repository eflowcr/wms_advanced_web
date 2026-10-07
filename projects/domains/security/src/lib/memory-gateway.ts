import {
  capabilities,
  SCREEN_CATALOG,
  SecurityError,
  effectiveAccess,
  sameContext,
  type Actor,
  type Assignment,
  type Grants,
  type Profile,
  type SecurityErrorCode,
  type SecurityGateway,
  type SecurityRequest,
  type SecuritySnapshot,
  type SecurityUser,
} from '@ewms/core/security';

import { demoSnapshot } from './security.fixtures';
export { demoSnapshot } from './security.fixtures';

const ADMIN = ['profiles.view', 'profiles.manage', 'profiles.assign', 'profiles.inspect'];

export interface MemoryOptions {
  readonly latency?: number;
  readonly state?: SecuritySnapshot;
}

/** Simulación en memoria; sus comprobaciones no sustituyen autorización del servidor. */
export class MemorySecurityGateway implements SecurityGateway {
  private state: SecuritySnapshot;
  private readonly latency: number;
  private nextFailure: SecurityErrorCode | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly createdScopes = new Map<string, Actor>();

  constructor(options: MemoryOptions = {}) {
    this.state = structuredClone(options.state ?? demoSnapshot());
    this.latency = options.latency ?? 120;
    for (const user of this.state.users) {
      const assignment = this.state.assignments.find((a) => a.userId === user.id);
      if (assignment)
        this.createdScopes.set(user.id, {
          userId: user.id,
          warehouseId: assignment.warehouseId,
          ownerId: assignment.ownerId,
        });
    }
  }

  failNext(code: SecurityErrorCode): void {
    this.nextFailure = code;
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async access(actor: Actor | null, signal: AbortSignal) {
    await this.wait(signal);
    return {
      grants: effectiveAccess(this.state, actor),
      user:
        actor === null
          ? null
          : (this.state.users.find((u) => u.id === actor.userId && u.active) ?? null),
    };
  }

  async snapshot(request: SecurityRequest): Promise<SecuritySnapshot> {
    await this.authorize(request, 'profiles.view');
    const scopes = this.state.contexts.filter((c) =>
      this.allowed({ ...request.actor, ...c }, 'profiles.view'),
    );
    const assignments = this.state.assignments.filter((a) => scopes.some((c) => sameContext(c, a)));
    return structuredClone({
      ...this.state,
      contexts: scopes,
      assignments,
      users: this.state.users.filter(
        (u) =>
          assignments.some((a) => a.userId === u.id) ||
          sameContext(
            this.createdScopes.get(u.id) ?? { warehouseId: '', ownerId: '' },
            request.actor,
          ),
      ),
      profiles: this.state.profiles.filter(
        (p) =>
          assignments.some((a) => a.profileId === p.id) ||
          !this.state.assignments.some((a) => a.profileId === p.id),
      ),
    });
  }

  async users(request: SecurityRequest): Promise<readonly SecurityUser[]> {
    await this.authorize(request, 'users.view');
    return structuredClone(
      this.state.users.filter(
        (u) =>
          this.state.assignments.some((a) => a.userId === u.id && sameContext(a, request.actor)) ||
          sameContext(
            this.createdScopes.get(u.id) ?? { warehouseId: '', ownerId: '' },
            request.actor,
          ),
      ),
    );
  }

  async inspect(request: SecurityRequest, target: Actor): Promise<Grants> {
    await this.authorize(request, 'profiles.inspect');
    if (
      !this.state.contexts.some((c) => sameContext(c, target)) ||
      !this.state.users.some((u) => u.id === target.userId)
    )
      throw new SecurityError('invalid');
    if (
      !this.allowed(
        { ...request.actor, warehouseId: target.warehouseId, ownerId: target.ownerId },
        'profiles.inspect',
      )
    )
      throw new SecurityError('delegation');
    return effectiveAccess(this.state, target);
  }

  async saveProfile(request: SecurityRequest, profile: Profile): Promise<void> {
    await this.authorize(request, 'profiles.manage');
    this.validName(profile.name);
    this.validId(profile.id);
    const previous = this.state.profiles.find((p) => p.id === profile.id);
    this.version(previous?.version ?? 0, profile.version);
    if (
      this.state.profiles.some(
        (p) => p.id !== profile.id && this.normalized(p.name) === this.normalized(profile.name),
      )
    )
      throw new SecurityError('duplicate');
    if (
      new Set(profile.grants).size !== profile.grants.length ||
      profile.grants.some((g) => !capabilities().includes(g))
    )
      throw new SecurityError('invalid');
    for (const screen of SCREEN_CATALOG) {
      if (
        screen.actions.some((a) => profile.grants.includes(a)) &&
        !profile.grants.includes(`${screen.id}.view`)
      )
        throw new SecurityError('invalid');
    }
    const affected = this.state.assignments.filter((a) => a.profileId === profile.id);
    const contexts = affected.length ? affected : [request.actor];
    for (const context of contexts) {
      const actor = {
        ...request.actor,
        warehouseId: context.warehouseId,
        ownerId: context.ownerId,
      };
      if (
        !this.allowed(actor, 'profiles.manage') ||
        profile.grants.some((g) => !this.allowed(actor, g))
      )
        throw new SecurityError('delegation');
    }
    const saved = {
      ...profile,
      name: profile.name.trim(),
      grants: [...profile.grants],
      version: profile.version + 1,
    };
    const profiles = previous
      ? this.state.profiles.map((p) => (p.id === profile.id ? saved : p))
      : [...this.state.profiles, saved];
    this.commit(request, { ...this.state, profiles });
  }

  async setAssignments(
    request: SecurityRequest,
    userId: string,
    assignments: readonly Assignment[],
    version: number,
  ): Promise<void> {
    await this.authorize(request, 'profiles.assign');
    this.version(this.state.version, version);
    if (
      !this.state.users.some((u) => u.id === userId) ||
      assignments.some(
        (a) =>
          a.userId !== userId ||
          !this.state.contexts.some((c) => sameContext(c, a)) ||
          !this.state.profiles.some((p) => p.id === a.profileId),
      )
    )
      throw new SecurityError('invalid');
    const key = (a: Assignment) =>
      JSON.stringify([a.userId, a.profileId, a.warehouseId, a.ownerId]);
    if (new Set(assignments.map(key)).size !== assignments.length)
      throw new SecurityError('duplicate');
    const old = this.state.assignments.filter((a) => a.userId === userId);
    const editable = (a: Assignment) =>
      this.allowed(
        { ...request.actor, warehouseId: a.warehouseId, ownerId: a.ownerId },
        'profiles.assign',
      );
    if (assignments.some((a) => !editable(a) && !old.some((b) => key(a) === key(b))))
      throw new SecurityError('delegation');
    const writableOld = old.filter(editable);
    const writableNext = assignments.filter(editable);
    const changed = [
      ...writableOld.filter((a) => !writableNext.some((b) => key(a) === key(b))),
      ...writableNext.filter((a) => !writableOld.some((b) => key(a) === key(b))),
    ];
    for (const assignment of changed) {
      const actor = {
        ...request.actor,
        warehouseId: assignment.warehouseId,
        ownerId: assignment.ownerId,
      };
      if (!this.allowed(actor, 'profiles.assign')) throw new SecurityError('delegation');
      const profile = this.state.profiles.find((p) => p.id === assignment.profileId)!;
      if (profile.grants.some((g) => !this.allowed(actor, g)))
        throw new SecurityError('delegation');
    }
    this.commit(request, {
      ...this.state,
      assignments: [
        ...this.state.assignments.filter((a) => a.userId !== userId || !editable(a)),
        ...writableNext,
      ],
    });
  }

  async saveUser(request: SecurityRequest, user: SecurityUser): Promise<void> {
    await this.authorize(request, user.version === 0 ? 'users.create' : 'users.edit');
    const previous = this.state.users.find((u) => u.id === user.id);
    if (!previous && user.version !== 0) throw new SecurityError('conflict');
    this.validName(user.name);
    this.validId(user.id);
    if (typeof user.active !== 'boolean') throw new SecurityError('invalid');
    this.version(previous?.version ?? 0, user.version);
    if (previous && previous.active !== user.active) throw new SecurityError('invalid');
    if (previous) this.userAuthority(request.actor, user.id, 'users.edit');
    const saved = { ...user, name: user.name.trim(), version: user.version + 1 };
    const users = previous
      ? this.state.users.map((u) => (u.id === user.id ? saved : u))
      : [...this.state.users, saved];
    this.commit(request, { ...this.state, users });
    if (!previous) this.createdScopes.set(user.id, { ...request.actor });
  }

  async setUserStatus(
    request: SecurityRequest,
    id: string,
    active: boolean,
    version: number,
  ): Promise<void> {
    await this.authorize(request, 'users.status');
    if (typeof active !== 'boolean') throw new SecurityError('invalid');
    const user = this.state.users.find((u) => u.id === id);
    if (!user) throw new SecurityError('invalid');
    this.version(user.version, version);
    this.userAuthority(request.actor, id, 'users.status');
    this.commit(request, {
      ...this.state,
      users: this.state.users.map((u) =>
        u.id === id ? { ...u, active, version: version + 1 } : u,
      ),
    });
  }

  private allowed(actor: Actor, capability: string): boolean {
    return (effectiveAccess(this.state, actor)[capability]?.length ?? 0) > 0;
  }

  private async authorize(request: SecurityRequest, capability: string): Promise<void> {
    await this.wait(request.signal);
    if (!this.allowed(request.actor, capability)) throw new SecurityError('denied');
  }

  private async wait(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw new SecurityError('aborted');
    await new Promise<void>((resolve) => setTimeout(resolve, this.latency));
    if (signal.aborted) throw new SecurityError('aborted');
    const failure = this.nextFailure;
    this.nextFailure = null;
    if (failure) throw new SecurityError(failure);
  }

  private normalized(name: string): string {
    return name.trim().normalize('NFKC').toLocaleLowerCase('en');
  }
  private validName(name: string): void {
    if (name.trim().length < 2 || name.trim().length > 80) throw new SecurityError('invalid');
  }
  private validId(id: string): void {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new SecurityError('invalid');
  }
  private version(current: number, expected: number): void {
    if (current !== expected) throw new SecurityError('conflict');
  }
  private userAuthority(actor: Actor, userId: string, capability: string): void {
    const scope = this.createdScopes.get(userId);
    if (
      !scope ||
      !this.allowed(
        { ...actor, warehouseId: scope.warehouseId, ownerId: scope.ownerId },
        capability,
      )
    )
      throw new SecurityError('delegation');
    for (const assignment of this.state.assignments.filter((a) => a.userId === userId)) {
      if (
        !this.allowed(
          { ...actor, warehouseId: assignment.warehouseId, ownerId: assignment.ownerId },
          capability,
        )
      )
        throw new SecurityError('delegation');
    }
  }

  private commit(request: SecurityRequest, next: SecuritySnapshot): void {
    if (request.signal.aborted) throw new SecurityError('aborted');
    for (const context of this.state.contexts) {
      const actor = { ...request.actor, ...context };
      const old = effectiveAccess(this.state, actor);
      const updated = effectiveAccess(next, actor);
      if (Object.keys(updated).some((capability) => !old[capability]?.length))
        throw new SecurityError('selfEscalation');
      if (
        !next.users.some(
          (u) =>
            u.active &&
            ADMIN.every(
              (capability) =>
                (effectiveAccess(next, { userId: u.id, ...context })[capability]?.length ?? 0) > 0,
            ),
        )
      )
        throw new SecurityError('lastAdmin');
    }
    this.state = structuredClone({ ...next, version: this.state.version + 1 });
    for (const listener of this.listeners) listener();
  }
}
