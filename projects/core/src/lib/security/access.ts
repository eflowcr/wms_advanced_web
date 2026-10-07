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
  /** Área funcional de la comanda: el primer segmento del código. */
  readonly module: string;
  readonly labelKey: string;
  readonly route: string;
  readonly status: 'implemented' | 'internal' | 'construction';
  readonly actions: readonly string[];
}
export type Grants = Readonly<Record<string, readonly string[]>>;

/** Un permiso de la comanda: módulo, opción y acción, en inglés (`security.users:create`). */
export interface Permission {
  readonly module: string;
  readonly option: string;
  readonly action: string;
}

export function parsePermission(code: string): Permission | null {
  const match = /^([a-z][a-z-]*)\.([a-z][a-z-]*):([a-z][a-z-]*)$/.exec(code);
  return match ? { module: match[1]!, option: match[2]!, action: match[3]! } : null;
}

/** La acción Acceder de una pantalla: la que exige el guard y abre sus demás acciones. */
export function accessCode(screen: Pick<ScreenDefinition, 'id' | 'module'>): string {
  return `${screen.module}.${screen.id}:access`;
}

/** Catálogo cerrado: una acción depende del acceso a su pantalla. */
export const SCREEN_CATALOG: readonly ScreenDefinition[] = [
  {
    id: 'dashboard',
    module: 'general',
    labelKey: 'shell.menu.dashboard',
    route: '/',
    status: 'internal',
    actions: [],
  },
  {
    id: 'articles',
    module: 'catalogs',
    route: '/catalogos/articulos',
    labelKey: 'shell.menu.articles',
    status: 'construction',
    actions: [],
  },
  {
    id: 'clients',
    module: 'catalogs',
    route: '/catalogos/clientes',
    labelKey: 'shell.menu.clients',
    status: 'construction',
    actions: [],
  },
  {
    id: 'suppliers',
    module: 'catalogs',
    route: '/catalogos/proveedores',
    labelKey: 'shell.menu.suppliers',
    status: 'construction',
    actions: [],
  },
  {
    id: 'locations',
    module: 'catalogs',
    route: '/catalogos/ubicaciones',
    labelKey: 'shell.menu.locations',
    status: 'construction',
    actions: [],
  },
  {
    id: 'warehouses',
    module: 'catalogs',
    route: '/catalogos/almacenes',
    labelKey: 'shell.menu.warehouses',
    status: 'construction',
    actions: [],
  },
  {
    id: 'units',
    module: 'catalogs',
    route: '/catalogos/unidades',
    labelKey: 'shell.menu.units',
    status: 'construction',
    actions: [],
  },
  {
    id: 'lots',
    module: 'catalogs',
    route: '/catalogos/lotes',
    labelKey: 'shell.menu.lots',
    status: 'construction',
    actions: [],
  },
  {
    id: 'serials',
    module: 'catalogs',
    route: '/catalogos/series',
    labelKey: 'shell.menu.serials',
    status: 'construction',
    actions: [],
  },
  {
    id: 'carriers',
    module: 'catalogs',
    route: '/catalogos/transportistas',
    labelKey: 'shell.menu.carriers',
    status: 'construction',
    actions: [],
  },
  {
    id: 'rates',
    module: 'catalogs',
    route: '/catalogos/tarifas',
    labelKey: 'shell.menu.rates',
    status: 'construction',
    actions: [],
  },
  {
    id: 'users',
    module: 'security',
    labelKey: 'shell.menu.users',
    route: '/configuracion/usuarios',
    status: 'implemented',
    actions: [
      'security.users:create',
      'security.users:update',
      'security.users:deactivate',
      'security.users:export',
    ],
  },
  {
    id: 'profiles',
    module: 'security',
    labelKey: 'shell.menu.profiles',
    route: '/configuracion/perfiles',
    status: 'implemented',
    actions: ['security.profiles:update', 'security.profiles:assign', 'security.profiles:inspect'],
  },
  {
    id: 'params',
    module: 'settings',
    route: '/configuracion/parametros',
    labelKey: 'shell.menu.params',
    status: 'construction',
    actions: [],
  },
  {
    id: 'design-system',
    module: 'general',
    labelKey: 'shell.menu.designSystem',
    route: '/design-system',
    status: 'internal',
    actions: [],
  },
];

export function capabilities(): readonly string[] {
  return SCREEN_CATALOG.flatMap((screen) => [accessCode(screen), ...screen.actions]);
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
      const view = accessCode(screen);
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
