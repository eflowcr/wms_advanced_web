import type { SelectOption } from '@ewms/design-system';

/**
 * Ubicaciones de ejemplo para el Select de la fila mixta. Simulan lo que mandaría el backend:
 * van tal cual, sin traducir.
 */
export const LOCATION_OPTIONS: readonly SelectOption[] = [
  { value: 'a', label: 'Almacén central' },
  { value: 'b', label: 'Muelle 3' },
  { value: 'c', label: 'Cuarentena' },
];
