import { describe, expect, it } from 'vitest';
import { effectiveAccess, SCREEN_CATALOG, type SecuritySnapshot } from './access';

const state: SecuritySnapshot = {
  version: 1,
  users: [{ id: 'u', name: 'User', active: true, version: 1 }],
  profiles: [
    { id: 'read', name: 'Read', grants: ['users.view'], version: 1 },
    { id: 'write', name: 'Write', grants: ['users.view', 'users.create'], version: 1 },
    { id: 'broken', name: 'Broken', grants: ['users.export'], version: 1 },
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
      'users.view': ['read'],
    });
  });
  it('unites positive grants and preserves their provenance', () => {
    const assignments = [
      ...state.assignments,
      { userId: 'u', profileId: 'write', warehouseId: 'A', ownerId: 'X' },
    ];
    expect(
      effectiveAccess({ ...state, assignments }, { userId: 'u', warehouseId: 'A', ownerId: 'X' }),
    ).toEqual({ 'users.view': ['read', 'write'], 'users.create': ['write'] });
  });
  it('denies missing, inactive and unknown identities and unknown capabilities', () => {
    const actor = { userId: 'u', warehouseId: 'A', ownerId: 'X' };
    expect(effectiveAccess(state, null)).toEqual({});
    expect(effectiveAccess(state, { ...actor, userId: 'missing' })).toEqual({});
    expect(
      effectiveAccess({ ...state, users: [{ ...state.users[0]!, active: false }] }, actor),
    ).toEqual({});
    const profiles = [{ ...state.profiles[0]!, grants: ['users.view', 'users.future', '*'] }];
    expect(effectiveAccess({ ...state, profiles }, actor)).toEqual({ 'users.view': ['read'] });
  });
  it('requires the screen grant and declares no invented actions on unfinished screens', () => {
    expect(
      effectiveAccess(state, { userId: 'u', warehouseId: 'A', ownerId: 'X' })['users.export'],
    ).toBeUndefined();
    expect(
      SCREEN_CATALOG.filter((s) => s.status === 'construction').every(
        (s) => s.actions.length === 0,
      ),
    ).toBe(true);
    expect(new Set(SCREEN_CATALOG.map((s) => s.id)).size).toBe(SCREEN_CATALOG.length);
  });
});
