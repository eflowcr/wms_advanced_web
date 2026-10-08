import {
  accessCode,
  SCREEN_CATALOG,
  sameContext,
  type AccessContext,
  type Actor,
  type Grants,
  type Profile,
  type SecuritySnapshot,
  type SecurityUser,
  type Validity,
} from './access';

// Reglas que solo usan las pantallas de administración y el simulador. Viven fuera de access.ts,
// que comparte chunk con el arranque, para no pesar en la ruta crítica de `/`.

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

export interface ModuleDefinition {
  readonly id: string;
  /**
   * Un módulo interno no se asigna a un usuario externo (C5).
   * Ver vault: 0024 - Afiliacion vigencia y alta masiva.
   */
  readonly internal: boolean;
}
export const MODULE_CATALOG: readonly ModuleDefinition[] = [
  { id: 'general', internal: false },
  { id: 'catalogs', internal: false },
  { id: 'security', internal: true },
  { id: 'settings', internal: true },
];

export function internalCapability(code: string): boolean {
  const module = parsePermission(code)?.module;
  return MODULE_CATALOG.some((m) => m.id === module && m.internal);
}

/**
 * Lo que la consola ofrece a un externo: perfiles sin módulos internos, en contextos de su
 * compañía. Es presentación: el servidor decide y rechaza con `externalAffiliation`.
 */
export function assignableTo(user: SecurityUser, profile: Profile, context: AccessContext): boolean {
  return (
    user.affiliation === 'internal' ||
    (context.ownerId === user.companyId && !profile.grants.some(internalCapability))
  );
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function inForce(validity: Validity, day: string): boolean {
  return (
    (!validity.validFrom || validity.validFrom <= day) &&
    (!validity.validUntil || day <= validity.validUntil)
  );
}

/** Solo cuentan las asignaciones vigentes el día `day`. */
export function effectiveAccess(
  state: SecuritySnapshot,
  actor: Actor | null,
  day = isoToday(),
): Grants {
  if (
    actor === null ||
    !state.users.some((u) => u.id === actor.userId && u.active) ||
    !state.contexts.some((c) => sameContext(c, actor))
  )
    return {};
  const result: Record<string, string[]> = {};
  for (const assignment of state.assignments.filter(
    (a) => a.userId === actor.userId && sameContext(a, actor) && inForce(a, day),
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
