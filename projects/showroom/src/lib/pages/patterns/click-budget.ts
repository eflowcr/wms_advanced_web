import {
  CANCEL_MAX_CLICKS,
  CREATE_MAX_CLICKS,
  EDIT_MAX_CLICKS,
  OPEN_FAVORITE_MAX_CLICKS,
  SEARCH_MAX_CLICKS,
  type FlowId,
} from '@ewms/shared';

/** Las cifras son de `@ewms/shared` (REQ-FE-DS4-003 RFE-05): acá solo se nombran en pantalla. */
export type { FlowId };

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
