export interface AccessContext {
  readonly warehouseId: string;
  readonly ownerId: string;
}
export interface Actor extends AccessContext {
  readonly userId: string;
}
export interface SecurityUser {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly version: number;
}
export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly grants: readonly string[];
  readonly version: number;
}
export interface Assignment extends Actor {
  readonly profileId: string;
}
export interface SecuritySnapshot {
  readonly version: number;
  readonly users: readonly SecurityUser[];
  readonly profiles: readonly Profile[];
  readonly assignments: readonly Assignment[];
  readonly contexts: readonly AccessContext[];
}
export interface ScreenDefinition {
  readonly id: string;
  readonly labelKey: string;
  readonly route: string;
  readonly status: 'implemented' | 'internal' | 'construction';
  readonly actions: readonly string[];
}
export type Grants = Readonly<Record<string, readonly string[]>>;

/** Catálogo cerrado: una acción depende del acceso a su pantalla. */
export const SCREEN_CATALOG: readonly ScreenDefinition[] = [
  {
    id: 'dashboard',
    labelKey: 'shell.menu.dashboard',
    route: '/',
    status: 'internal',
    actions: [],
  },
  {
    id: 'articles',
    route: '/catalogos/articulos',
    labelKey: 'shell.menu.articles',
    status: 'construction',
    actions: [],
  },
  {
    id: 'clients',
    route: '/catalogos/clientes',
    labelKey: 'shell.menu.clients',
    status: 'construction',
    actions: [],
  },
  {
    id: 'suppliers',
    route: '/catalogos/proveedores',
    labelKey: 'shell.menu.suppliers',
    status: 'construction',
    actions: [],
  },
  {
    id: 'locations',
    route: '/catalogos/ubicaciones',
    labelKey: 'shell.menu.locations',
    status: 'construction',
    actions: [],
  },
  {
    id: 'warehouses',
    route: '/catalogos/almacenes',
    labelKey: 'shell.menu.warehouses',
    status: 'construction',
    actions: [],
  },
  {
    id: 'units',
    route: '/catalogos/unidades',
    labelKey: 'shell.menu.units',
    status: 'construction',
    actions: [],
  },
  {
    id: 'lots',
    route: '/catalogos/lotes',
    labelKey: 'shell.menu.lots',
    status: 'construction',
    actions: [],
  },
  {
    id: 'serials',
    route: '/catalogos/series',
    labelKey: 'shell.menu.serials',
    status: 'construction',
    actions: [],
  },
  {
    id: 'carriers',
    route: '/catalogos/transportistas',
    labelKey: 'shell.menu.carriers',
    status: 'construction',
    actions: [],
  },
  {
    id: 'rates',
    route: '/catalogos/tarifas',
    labelKey: 'shell.menu.rates',
    status: 'construction',
    actions: [],
  },
  {
    id: 'users',
    labelKey: 'shell.menu.users',
    route: '/configuracion/usuarios',
    status: 'implemented',
    actions: ['users.create', 'users.edit', 'users.status', 'users.export'],
  },
  {
    id: 'profiles',
    labelKey: 'shell.menu.profiles',
    route: '/configuracion/perfiles',
    status: 'implemented',
    actions: ['profiles.manage', 'profiles.assign', 'profiles.inspect'],
  },
  {
    id: 'params',
    route: '/configuracion/parametros',
    labelKey: 'shell.menu.params',
    status: 'construction',
    actions: [],
  },
  {
    id: 'design-system',
    labelKey: 'shell.menu.designSystem',
    route: '/design-system',
    status: 'internal',
    actions: [],
  },
];

export function capabilities(): readonly string[] {
  return SCREEN_CATALOG.flatMap((screen) => [`${screen.id}.view`, ...screen.actions]);
}

export function sameContext(a: AccessContext, b: AccessContext): boolean {
  return a.warehouseId === b.warehouseId && a.ownerId === b.ownerId;
}

export function effectiveAccess(state: SecuritySnapshot, actor: Actor | null): Grants {
  if (
    actor === null ||
    !state.users.some((u) => u.id === actor.userId && u.active) ||
    !state.contexts.some((c) => sameContext(c, actor))
  )
    return {};
  const result: Record<string, string[]> = {};
  for (const assignment of state.assignments.filter(
    (a) => a.userId === actor.userId && sameContext(a, actor),
  )) {
    const profile = state.profiles.find((p) => p.id === assignment.profileId);
    if (!profile) continue;
    for (const screen of SCREEN_CATALOG) {
      const view = `${screen.id}.view`;
      if (!profile.grants.includes(view)) continue;
      for (const capability of [
        view,
        ...screen.actions.filter((action) => profile.grants.includes(action)),
      ]) {
        const sources = (result[capability] ??= []);
        if (!sources.includes(profile.id)) sources.push(profile.id);
      }
    }
  }
  return result;
}

export interface AccessResult {
  readonly grants: Grants;
  readonly user: SecurityUser | null;
}
export interface SecurityRequest {
  readonly actor: Actor;
  readonly signal: AbortSignal;
}
export interface SecurityGateway {
  access(actor: Actor | null, signal: AbortSignal): Promise<AccessResult>;
  snapshot(request: SecurityRequest): Promise<SecuritySnapshot>;
  inspect(request: SecurityRequest, target: Actor): Promise<Grants>;
  users(request: SecurityRequest): Promise<readonly SecurityUser[]>;
  saveProfile(request: SecurityRequest, profile: Profile): Promise<void>;
  setAssignments(
    request: SecurityRequest,
    userId: string,
    assignments: readonly Assignment[],
    version: number,
  ): Promise<void>;
  saveUser(request: SecurityRequest, user: SecurityUser): Promise<void>;
  setUserStatus(
    request: SecurityRequest,
    id: string,
    active: boolean,
    version: number,
  ): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export type SecurityErrorCode =
  | 'denied'
  | 'invalid'
  | 'duplicate'
  | 'conflict'
  | 'lastAdmin'
  | 'selfEscalation'
  | 'delegation'
  | 'unavailable'
  | 'aborted';
export class SecurityError extends Error {
  constructor(readonly code: SecurityErrorCode) {
    super(code);
  }
}
