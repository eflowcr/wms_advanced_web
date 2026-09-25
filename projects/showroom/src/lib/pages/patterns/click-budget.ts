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
  /** Clave del diccionario del catálogo con el nombre que se muestra en pantalla. */
  readonly name: string;
  readonly max: number;
  /** Clave de desde dónde se cuenta el presupuesto. */
  readonly from: string;
}

/**
 * t(showroom.patternSearchCreateEdit.budget.flows.search.name,
 *   showroom.patternSearchCreateEdit.budget.flows.search.from,
 *   showroom.patternSearchCreateEdit.budget.flows.create.name,
 *   showroom.patternSearchCreateEdit.budget.flows.create.from,
 *   showroom.patternSearchCreateEdit.budget.flows.edit.name,
 *   showroom.patternSearchCreateEdit.budget.flows.edit.from,
 *   showroom.patternSearchCreateEdit.budget.flows.cancel.name,
 *   showroom.patternSearchCreateEdit.budget.flows.cancel.from,
 *   showroom.patternSearchCreateEdit.budget.flows.favorite.name,
 *   showroom.patternSearchCreateEdit.budget.flows.favorite.from)
 */
export const FLOW_BUDGETS: readonly FlowBudget[] = [
  {
    id: 'search',
    name: 'showroom.patternSearchCreateEdit.budget.flows.search.name',
    max: SEARCH_MAX_CLICKS,
    from: 'showroom.patternSearchCreateEdit.budget.flows.search.from',
  },
  {
    id: 'create',
    name: 'showroom.patternSearchCreateEdit.budget.flows.create.name',
    max: CREATE_MAX_CLICKS,
    from: 'showroom.patternSearchCreateEdit.budget.flows.create.from',
  },
  {
    id: 'edit',
    name: 'showroom.patternSearchCreateEdit.budget.flows.edit.name',
    max: EDIT_MAX_CLICKS,
    from: 'showroom.patternSearchCreateEdit.budget.flows.edit.from',
  },
  {
    id: 'cancel',
    name: 'showroom.patternSearchCreateEdit.budget.flows.cancel.name',
    max: CANCEL_MAX_CLICKS,
    from: 'showroom.patternSearchCreateEdit.budget.flows.cancel.from',
  },
  {
    id: 'favorite',
    name: 'showroom.patternSearchCreateEdit.budget.flows.favorite.name',
    max: OPEN_FAVORITE_MAX_CLICKS,
    from: 'showroom.patternSearchCreateEdit.budget.flows.favorite.from',
  },
];
