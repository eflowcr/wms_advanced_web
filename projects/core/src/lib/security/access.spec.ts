import { describe, expect, it } from 'vitest';
import {
  accessCode,
  capabilities,
  effectiveAccess,
  parsePermission,
  SCREEN_CATALOG,
  type SecuritySnapshot,
} from './access';

const state: SecuritySnapshot = {
  version: 1,
  users: [{ id: 'u', name: 'User', active: true, version: 1 }],
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
