/*
 * Presupuesto de clics: única copia de las cifras de REQ-FE-DS4-003 §2.2 (HG-02), que importan
 * la pantalla de patrón y e2e/click-budget.e2e.ts. Se cambian primero en el vault, luego acá.
 * Cómo se cuenta un clic (§2.1; con teclado, cero): ver vault: REQ-FE-DS4-003 - Minimo de clics.
 */

/** Encontrar un registro, desde cualquier pantalla. */
export const SEARCH_MAX_CLICKS = 2;

/** Crear un registro, desde la pantalla de su módulo. */
export const CREATE_MAX_CLICKS = 2;

/** Editar un registro, encontrarlo incluido: la búsqueda está contenida y el tercer clic abre la edición. */
export const EDIT_MAX_CLICKS = 3;

/** Cancelar lo que sea; con Escape, cero. Pedir confirmar la cancelación de algo no guardado gasta el presupuesto. */
export const CANCEL_MAX_CLICKS = 1;

/**
 * Abrir un favorito desde cualquier pantalla (DS-5): el bloque está fijo en la navegación
 * (REQ-FE-DS4-002 RFE-04), así que pulsar la entrada ya es navegar.
 */
export const OPEN_FAVORITE_MAX_CLICKS = 1;

/** Flujos que cubre el estándar, para que los recorran la página y la prueba. */
export type FlowId = 'search' | 'create' | 'edit' | 'cancel' | 'favorite';

export interface FlowBudget {
  readonly id: FlowId;
  /** Se muestra en pantalla, en español como el resto del catálogo. */
  readonly name: string;
  readonly max: number;
  /** Desde dónde se cuenta el presupuesto. */
  readonly from: string;
}

export const FLOW_BUDGETS: readonly FlowBudget[] = [
  {
    id: 'search',
    name: 'Buscar una expedición',
    max: SEARCH_MAX_CLICKS,
    from: 'Desde cualquier pantalla de la aplicación',
  },
  {
    id: 'create',
    name: 'Crear una expedición',
    max: CREATE_MAX_CLICKS,
    from: 'Desde la pantalla de su módulo',
  },
  {
    id: 'edit',
    name: 'Editar una existente',
    max: EDIT_MAX_CLICKS,
    from: 'Desde la pantalla de su módulo, encontrarla incluida',
  },
  {
    id: 'cancel',
    name: 'Cancelar lo que sea',
    max: CANCEL_MAX_CLICKS,
    from: 'Siempre. Con Escape, cero',
  },
  {
    id: 'favorite',
    name: 'Abrir un favorito',
    max: OPEN_FAVORITE_MAX_CLICKS,
    from: 'Desde cualquier pantalla, en el bloque fijo del rail',
  },
];
