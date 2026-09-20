/**
 * The three tones a confirmation can take.
 *
 * `info` is the name and `neutral` is the colour, exactly as in the Banner and
 * the Toast -- and here it needed saying twice, because the Figma record of
 * this component painted Info blue. That was superseded by the brand rule: the
 * blue means "you click this" (Fundamentos de Marca), and the Modal sheet
 * carries the correction at the top of the page.
 */
export type DialogTone = 'danger' | 'warning' | 'info';

/** What `DialogService.confirm` takes. Every string already translated (ADR 0008). */
export interface ConfirmOptions {
  readonly title: string;
  readonly body: string;
  readonly tone: DialogTone;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

/**
 * What the confirmation component receives: the options, plus the two ids the
 * service minted for the container's `aria-labelledby` and `aria-describedby`.
 *
 * Internal. It exists because the ids have to be in the CDK's config BEFORE
 * the dialog opens, so they cannot be generated inside the component that uses
 * them.
 */
export interface ConfirmDialogData extends ConfirmOptions {
  readonly titleId: string;
  readonly bodyId: string;
}

/**
 * Whether the backdrop is allowed to dismiss this dialog.
 *
 * DELIBERATE FRICTION, AND IT COMES FROM THE SHEET: a destructive confirmation
 * does not close when you click outside it. The reasoning is that a stray
 * click is the cheapest gesture there is, and the whole point of the dialog is
 * to make the destructive answer cost more than the safe one. A warning or an
 * informative dialog has nothing to protect, so it closes like any overlay.
 *
 * Escape closes all three, always. That is not the same question: Escape is a
 * deliberate key, it is the documented way out of a modal, and WCAG 2.1.2 is
 * about not trapping the keyboard. A dialog that swallowed Escape would be a
 * keyboard trap dressed up as friction.
 */
export function backdropDismisses(tone: DialogTone): boolean {
  return tone !== 'danger';
}

/**
 * The icon zone: a 56 px circle in the tone's light surface, ringed in its
 * border, with a coloured halo behind it -- AND NO GLYPH INSIDE.
 *
 * THIS IS AN EXCEPTION THE SHEET DOCUMENTS, NOT A PIECE MISSING. The Modal
 * carries a warning to whoever arrives later with the icon set in hand: the
 * shape with the halo was validated with the user on 27/08, and putting a
 * glyph in it is a decision somebody has to take, not a gap to be tidied up.
 *
 * The halo lives in tokens.css as `--shadow-halo-*`, composed of semantic
 * tokens the way `--focus-ring-shadow` is.
 */
export function dialogIconClasses(tone: DialogTone): string {
  switch (tone) {
    case 'danger':
      return 'bg-danger-surface border-danger shadow-(--shadow-halo-danger)';
    case 'warning':
      return 'bg-warning-surface border-warning shadow-(--shadow-halo-warning)';
    case 'info':
      return 'bg-neutral-surface border-neutral shadow-(--shadow-halo-neutral)';
  }
}

/**
 * The confirm button's variant.
 *
 * Danger for a destructive answer, Primary for everything else -- which is
 * what the sheet's Figma variants already did (Danger on Delete, Primary on
 * Info and Warning). Cancel is always Secondary.
 */
export function confirmButtonVariant(tone: DialogTone): 'danger' | 'primary' {
  return tone === 'danger' ? 'danger' : 'primary';
}

/**
 * The box.
 *
 * `--radius-dialog` and `--shadow-dialog` are the Modal's own geometry, and
 * the only component in the system with geometry of its own: the elevation
 * scale stops at the modal, and this is the one level that asks for a third
 * layer and a wider spread.
 */
/*
 * The width comes through the 4 px spacing scale (120 x 4 = 480 px) and NOT
 * through Tailwind's default container scale, which ADR 0009 deletes: one of
 * those utilities compiles, applies nothing, and only gate 10 notices.
 *
 * The name of the deleted one is not written anywhere in this file, comment
 * included. The gate reads every quoted run in a .ts file as a possible class
 * name, and a pair of backticks in a comment is a quoted run -- which is
 * exactly how this note failed the build the first time it was written.
 */
export const DIALOG_BOX_CLASSES =
  'flex w-full max-w-120 flex-col items-center gap-4 bg-surface p-6 text-center ' +
  'rounded-dialog shadow-dialog border border-default border-solid';

/**
 * The backdrop: navy at 50 %, with the glass blur the sheet asks for.
 *
 * Navy and not black, like every other overlay in the system -- black puts the
 * scene out, navy tints it with the brand.
 */
export const DIALOG_BACKDROP_CLASSES = ['bg-overlay', 'backdrop-blur-dialog'];

/** The pane. The box carries the look; the pane only has to stay out of the way. */
export const DIALOG_PANEL_CLASSES = ['flex', 'max-w-full', 'p-4'];
