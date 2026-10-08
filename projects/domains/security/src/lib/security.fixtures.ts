import { type SecuritySnapshot } from '@ewms/core/security';

export function demoSnapshot(): SecuritySnapshot {
  const contexts = [
    { warehouseId: 'A', ownerId: 'X' },
    { warehouseId: 'B', ownerId: 'Y' },
  ];
  return {
    version: 1,
    contexts,
    users: [
      { id: 'admin', name: 'Ana Admin', active: true, version: 1, affiliation: 'internal' },
      { id: 'reader', name: 'Rosa Consulta', active: true, version: 1, affiliation: 'internal' },
      { id: 'operator', name: 'Luis Operación', active: true, version: 1, affiliation: 'internal' },
      { id: 'inactive', name: 'Usuario inactivo', active: false, version: 1, affiliation: 'internal' },
      {
        id: 'external',
        name: 'Carla Externa',
        active: true,
        version: 1,
        affiliation: 'external',
        companyId: 'Y',
      },
    ],
    profiles: [
      {
        id: 'admin',
        name: 'Administrator',
        grants: [
          'general.dashboard:access',
          'catalogs.articles:access',
          'catalogs.clients:access',
          'catalogs.suppliers:access',
          'catalogs.locations:access',
          'catalogs.warehouses:access',
          'catalogs.units:access',
          'catalogs.lots:access',
          'catalogs.serials:access',
          'catalogs.carriers:access',
          'catalogs.rates:access',
          'settings.params:access',
          'security.users:access',
          'security.users:create',
          'security.users:update',
          'security.users:deactivate',
          'security.users:export',
          'security.profiles:access',
          'security.profiles:update',
          'security.profiles:assign',
          'security.profiles:inspect',
        ],
        version: 1,
      },
      {
        id: 'read',
        name: 'Consultation',
        grants: [
          'general.dashboard:access',
          'security.users:access',
          'security.profiles:access',
          'security.profiles:inspect',
        ],
        version: 1,
      },
      {
        id: 'operate',
        name: 'Limited operation',
        grants: [
          'general.dashboard:access',
          'security.users:access',
          'security.users:create',
          'security.users:update',
        ],
        version: 1,
      },
      {
        id: 'catalogs',
        name: 'Catalog consultation',
        grants: [
          'general.dashboard:access',
          'catalogs.articles:access',
          'catalogs.clients:access',
          'catalogs.locations:access',
        ],
        version: 1,
      },
      {
        id: 'audit',
        name: 'Access audit',
        grants: [
          'general.dashboard:access',
          'security.users:access',
          'security.profiles:access',
          'security.profiles:inspect',
        ],
        version: 1,
      },
    ],
    assignments: [
      ...contexts.flatMap((context) => [
        { userId: 'admin', profileId: 'admin', ...context },
        { userId: 'reader', profileId: 'read', ...context },
        {
          userId: 'operator',
          profileId: context.warehouseId === 'A' ? 'operate' : 'read',
          ...context,
        },
        { userId: 'inactive', profileId: 'read', ...context },
      ]),
      { userId: 'external', profileId: 'catalogs', warehouseId: 'B', ownerId: 'Y' },
    ],
  };
}

/** Separación de funciones de la demostración: quien administra no audita en el mismo contexto. */
export function demoSegregation(): readonly (readonly [string, string])[] {
  return [['admin', 'audit']];
}
