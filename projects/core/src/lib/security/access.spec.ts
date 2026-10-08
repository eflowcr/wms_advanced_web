import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { accessCode, capabilities, SCREEN_CATALOG, type SecuritySnapshot } from './access';
import {
  assignableTo,
  effectiveAccess,
  inForce,
  internalCapability,
  isoToday,
  MODULE_CATALOG,
  parsePermission,
} from './access-rules';
import { SENSITIVE_CAPABILITIES } from './sensitive-capabilities';

const state: SecuritySnapshot = {
  version: 1,
  users: [{ id: 'u', name: 'User', active: true, version: 1, affiliation: 'internal' }],
  profiles: [
    { id: 'read', name: 'Read', grants: ['security.users:access'], version: 1 },
    {
      id: 'write',
      name: 'Write',
      grants: ['security.users:access', 'security.users:create'],
      version: 1,
    },
    { id: 'broken', name: 'Broken', grants: ['security.users:export'], version: 1 },
  ],
  contexts: [
    { warehouseId: 'A', ownerId: 'X' },
    { warehouseId: 'B', ownerId: 'Y' },
  ],
  assignments: [
    { userId: 'u', profileId: 'read', warehouseId: 'A', ownerId: 'X' },
    { userId: 'u', profileId: 'write', warehouseId: 'B', ownerId: 'Y' },
    { userId: 'u', profileId: 'broken', warehouseId: 'A', ownerId: 'X' },
  ],
};

describe('effectiveAccess', () => {
  it('does not cross independent warehouse and owner lists', () => {
    expect(effectiveAccess(state, { userId: 'u', warehouseId: 'A', ownerId: 'Y' })).toEqual({});
    expect(effectiveAccess(state, { userId: 'u', warehouseId: 'A', ownerId: 'X' })).toEqual({
      'security.users:access': ['read'],
    });
  });
  it('unites positive grants and preserves their provenance', () => {
    const assignments = [
      ...state.assignments,
      { userId: 'u', profileId: 'write', warehouseId: 'A', ownerId: 'X' },
    ];
    expect(
      effectiveAccess({ ...state, assignments }, { userId: 'u', warehouseId: 'A', ownerId: 'X' }),
    ).toEqual({ 'security.users:access': ['read', 'write'], 'security.users:create': ['write'] });
  });
  it('denies missing, inactive and unknown identities and unknown capabilities', () => {
    const actor = { userId: 'u', warehouseId: 'A', ownerId: 'X' };
    expect(effectiveAccess(state, null)).toEqual({});
    expect(effectiveAccess(state, { ...actor, userId: 'missing' })).toEqual({});
    expect(
      effectiveAccess({ ...state, users: [{ ...state.users[0]!, active: false }] }, actor),
    ).toEqual({});
    const profiles = [
      { ...state.profiles[0]!, grants: ['security.users:access', 'users.future', '*'] },
    ];
    expect(effectiveAccess({ ...state, profiles }, actor)).toEqual({
      'security.users:access': ['read'],
    });
  });
  it('requires the screen grant and declares no invented actions on unfinished screens', () => {
    expect(
      effectiveAccess(state, { userId: 'u', warehouseId: 'A', ownerId: 'X' })[
        'security.users:export'
      ],
    ).toBeUndefined();
    expect(
      SCREEN_CATALOG.filter((s) => s.status === 'construction').every(
        (s) => s.actions.length === 0,
      ),
    ).toBe(true);
    expect(new Set(SCREEN_CATALOG.map((s) => s.id)).size).toBe(SCREEN_CATALOG.length);
  });
});

describe('assignment validity', () => {
  const actor = { userId: 'u', warehouseId: 'A', ownerId: 'X' };
  const dated = (validFrom: string | null, validUntil: string | null) => ({
    ...state,
    assignments: [{ ...state.assignments[0]!, validFrom, validUntil }],
  });
  it('counts an assignment only between its inclusive dates', () => {
    expect(inForce({ validFrom: '2026-10-01', validUntil: '2026-10-31' }, '2026-10-01')).toBe(true);
    expect(inForce({ validFrom: '2026-10-01', validUntil: '2026-10-31' }, '2026-10-31')).toBe(true);
    expect(inForce({ validFrom: '2026-10-01', validUntil: null }, '2026-09-30')).toBe(false);
    expect(inForce({ validFrom: null, validUntil: '2026-10-31' }, '2026-11-01')).toBe(false);
    expect(inForce({}, '2026-11-01')).toBe(true);
  });
  it('takes the local day, not the UTC one, at both ends of the day', () => {
    expect(isoToday(new Date(2026, 9, 8, 0, 5))).toBe('2026-10-08');
    expect(isoToday(new Date(2026, 9, 8, 23, 55))).toBe('2026-10-08');
    expect(isoToday(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
  });
  it('grants nothing from a scheduled or expired assignment', () => {
    expect(effectiveAccess(dated('2026-11-01', null), actor, '2026-10-07')).toEqual({});
    expect(effectiveAccess(dated(null, '2026-10-06'), actor, '2026-10-07')).toEqual({});
    expect(effectiveAccess(dated('2026-10-07', '2026-10-07'), actor, '2026-10-07')).toEqual({
      'security.users:access': ['read'],
    });
  });
});

describe('affiliation', () => {
  const internal = {
    id: 'i',
    name: 'Internal',
    active: true,
    version: 1,
    affiliation: 'internal',
    companyId: null,
  } as const;
  const external = { ...internal, affiliation: 'external', companyId: 'Y' } as const;
  const catalogs = { id: 'c', name: 'C', grants: ['catalogs.articles:access'], version: 1 };
  const security = { id: 's', name: 'S', grants: ['security.users:access'], version: 1 };
  it('offers an external user only profiles without internal modules in its own company', () => {
    const own = { warehouseId: 'B', ownerId: 'Y' };
    const other = { warehouseId: 'A', ownerId: 'X' };
    expect(assignableTo(external, catalogs, own)).toBe(true);
    expect(assignableTo(external, security, own)).toBe(false);
    expect(assignableTo(external, catalogs, other)).toBe(false);
    expect(assignableTo(internal, security, other)).toBe(true);
  });
  it('declares every screen module and marks security administration as internal', () => {
    for (const screen of SCREEN_CATALOG)
      expect(
        MODULE_CATALOG.some((m) => m.id === screen.module),
        screen.module,
      ).toBe(true);
    expect(internalCapability('security.users:access')).toBe(true);
    expect(internalCapability('catalogs.articles:access')).toBe(false);
  });
});

describe('sensitive permissions', () => {
  it('start empty until the CTO delivers the list', () => {
    expect(TestBed.inject(SENSITIVE_CAPABILITIES)).toEqual([]);
  });
});

describe('permission codes', () => {
  it('reads module, option and action, and rejects anything else', () => {
    expect(parsePermission('security.users:create')).toEqual({
      module: 'security',
      option: 'users',
      action: 'create',
    });
    expect(parsePermission('general.design-system:access')?.option).toBe('design-system');
    for (const bad of ['users.create', 'security.users', 'Security.users:create', 'a.b:c:d', ''])
      expect(parsePermission(bad), bad).toBeNull();
  });

  it('every catalog code has the form of the comanda and its screen module', () => {
    for (const screen of SCREEN_CATALOG) {
      expect(accessCode(screen)).toBe(`${screen.module}.${screen.id}:access`);
      for (const action of screen.actions) {
        expect(parsePermission(action), action).toMatchObject({
          module: screen.module,
          option: screen.id,
        });
      }
    }
    expect(capabilities().every((code) => parsePermission(code) !== null)).toBe(true);
  });
});
