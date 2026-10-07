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
      { id: 'admin', name: 'Ana Admin', active: true, version: 1 },
      { id: 'reader', name: 'Rosa Consulta', active: true, version: 1 },
      { id: 'operator', name: 'Luis Operación', active: true, version: 1 },
      { id: 'inactive', name: 'Usuario inactivo', active: false, version: 1 },
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
    ],
    assignments: contexts.flatMap((context) => [
      { userId: 'admin', profileId: 'admin', ...context },
      { userId: 'reader', profileId: 'read', ...context },
      {
        userId: 'operator',
        profileId: context.warehouseId === 'A' ? 'operate' : 'read',
        ...context,
      },
      { userId: 'inactive', profileId: 'read', ...context },
    ]),
  };
}
