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
          'dashboard.view',
          'articles.view',
          'clients.view',
          'suppliers.view',
          'locations.view',
          'warehouses.view',
          'units.view',
          'lots.view',
          'serials.view',
          'carriers.view',
          'rates.view',
          'params.view',
          'users.view',
          'users.create',
          'users.edit',
          'users.status',
          'users.export',
          'profiles.view',
          'profiles.manage',
          'profiles.assign',
          'profiles.inspect',
        ],
        version: 1,
      },
      {
        id: 'read',
        name: 'Consultation',
        grants: ['dashboard.view', 'users.view', 'profiles.view', 'profiles.inspect'],
        version: 1,
      },
      {
        id: 'operate',
        name: 'Limited operation',
        grants: ['dashboard.view', 'users.view', 'users.create', 'users.edit'],
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
