/**
 * THE CLICK BUDGET. ONE COPY OF THE NUMBERS, FOR THE PAGE AND FOR THE TEST.
 *
 * REQ-FE-DS4-003 §2.2 OWNS THESE FIGURES. This file does not decide them and
 * must not be where somebody changes them: the standard lives in the vault,
 * the code only verifies it. If a budget has to move, it moves in the note
 * first, with its reason, and then here.
 *
 * What the file buys is HG-02 of that REQ -- the numbers are not written
 * twice. `/design-system/patterns/search-create-edit` shows them, and
 * `e2e/click-budget.e2e.ts` asserts against them, and both import from here.
 * Two copies would let the screen advertise a budget the test was not
 * checking, which is precisely the showroom lying.
 *
 *
 * HOW A CLICK IS COUNTED (§2.1 of the REQ, in short)
 *
 *   1 click   a mouse press or a tap on a control that ADVANCES the flow --
 *             opening a menu, a panel or a dropdown included, even though
 *             none of those is the final step
 *   1 click   putting the focus in a field with the mouse, when the flow did
 *             not take it there by itself
 *   0 clicks  a keyboard shortcut, Tab, the arrows, Enter
 *   0 clicks  typing into a field that ALREADY has the focus
 *   0 clicks  a complete barcode scan
 *
 * The first consequence is deliberate and is the point of the whole standard:
 * A FLOW DONE ENTIRELY ON THE KEYBOARD COSTS ZERO. It is not an accounting
 * trick -- the operator has gloves on and a gun in one hand, and the standard
 * has to reward exactly that.
 */

/** Finding a record, from anywhere in the application. */
export const SEARCH_MAX_CLICKS = 2;

/** Creating a new record, from its module's screen. */
export const CREATE_MAX_CLICKS = 2;

/**
 * Editing an existing record, FINDING IT INCLUDED.
 *
 * One more than searching, and not searching plus editing: the search budget
 * is CONTAINED in this one. The third click is the one that opens the edit of
 * what was found.
 */
export const EDIT_MAX_CLICKS = 3;

/**
 * Cancelling anything. Always, and Escape always does it in zero.
 *
 * One and not two, because cancelling is not negotiable: a screen that asks
 * you to confirm the cancellation of something you never saved is spending the
 * budget on a question.
 */
export const CANCEL_MAX_CLICKS = 1;

/** The four flows the standard covers, for the page and the test to walk. */
export type FlowId = 'search' | 'create' | 'edit' | 'cancel';

export interface FlowBudget {
  readonly id: FlowId;
  /** Shown on the screen. Spanish, like the rest of the catalogue. */
  readonly name: string;
  readonly max: number;
  /** Where the budget is counted from. */
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
];
