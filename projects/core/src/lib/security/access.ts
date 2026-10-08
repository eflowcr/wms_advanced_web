export interface AccessContext {
  readonly warehouseId: string;
  readonly ownerId: string;
}
export interface Actor extends AccessContext {
  readonly userId: string;
}
/** Interna o externa (C5): un externo pertenece a una compañía, el propietario de sus contextos. */
export type Affiliation = 'internal' | 'external';
export interface SecurityUser {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly version: number;
  readonly affiliation: Affiliation;
  readonly companyId?: string | null;
}
export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly grants: readonly string[];
  readonly version: number;
}
/** Vigencia inclusiva en 'YYYY-MM-DD'; sin una fecha, queda abierta por ese lado. */
export interface Validity {
  readonly validFrom?: string | null;
  readonly validUntil?: string | null;
}
export interface Assignment extends Actor, Validity {
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
    actions: [
      'security.profiles:update',
      'security.profiles:assign',
      'security.profiles:inspect',
      'security.profiles:review',
    ],
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
  | 'selfAssignment'
  | 'segregation'
  | 'externalAffiliation'
  | 'dependency'
  | 'unavailable'
  | 'aborted';
/** `conflicts`: los perfiles en conflicto que nombra el servidor ante `segregation`. */
export class SecurityError extends Error {
  constructor(
    readonly code: SecurityErrorCode,
    readonly conflicts: readonly string[] = [],
  ) {
    super(code);
  }
}
