import type { SelectOption } from '@ewms/design-system';

/**
 * Registros de ejemplo que simulan lo que mandaría el backend: los almacenes van con su nombre
 * tal cual, sin traducir.
 */
export const WAREHOUSES: readonly SelectOption[] = [
  { value: 'central', label: 'Central' },
  { value: 'norte', label: 'Norte' },
];
