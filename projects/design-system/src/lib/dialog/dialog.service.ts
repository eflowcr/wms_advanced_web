import { Dialog, type DialogConfig, type DialogRef } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable } from '@angular/core';
import { ConfirmDialog } from './confirm-dialog';
import {
  backdropDismisses,
  DIALOG_BACKDROP_CLASSES,
  DIALOG_PANEL_CLASSES,
  type ConfirmDialogData,
  type ConfirmOptions,
} from './dialog.types';

let nextDialogId = 0;

/** What `open` takes: the CDK's config minus everything this service owns. */
export interface OpenDialogOptions<D> {
  readonly data?: D;
  /** Escape still closes. This governs the backdrop only. */
  readonly dismissOnBackdrop?: boolean;
  /** The dialog's accessible name, when it has no heading to point at. */
  readonly ariaLabel?: string;
  /** The id of the heading inside the component. Preferred over `ariaLabel`. */
  readonly ariaLabelledBy?: string;
}

/**
 * Modal dialogs, over `@angular/cdk/dialog`.
 *
 * WHAT THE CDK BRINGS, AND WHY IT IS NOT REBUILT HERE: the focus trap, the
 * `role="dialog"`, marking the rest of the document inert to assistive
 * technology, and putting the focus back where it came from. Each of those is
 * a small pile of edge cases -- what happens when the element that opened the
 * dialog is gone by the time it closes, what happens when the dialog opens
 * with nothing focusable inside -- and a hand-rolled version gets the common
 * path right and the edges wrong.
 *
 * WHAT THIS SERVICE ADDS: the two shapes a dialog takes in this system. A
 * confirmation, which is a question with two answers and comes back as a
 * promise; and a form, which is a component the consumer wrote.
 *
 *
 * THE BACKDROP DOES NOT CLOSE A DESTRUCTIVE DIALOG
 *
 * Deliberate friction, from the sheet. It is implemented by taking the CDK's
 * `disableClose` -- which governs Escape AND the backdrop together -- and
 * wiring the two separately: Escape always closes, the backdrop closes only
 * when the tone allows it.
 *
 * Leaving `disableClose` false would close both on a stray click. Leaving it
 * true would make the dialog a keyboard trap, which WCAG 2.1.2 forbids and
 * which is a far worse bug than a lost click. So it is true, and this service
 * answers the two events itself.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);

  /**
   * Ask a yes/no question. Resolves `true` only if the confirm button was
   * pressed; Escape, the backdrop, Cancel and a dialog closed from elsewhere
   * all resolve `false`.
   *
   * A promise and not an observable, because a confirmation has exactly one
   * answer and the call site is almost always an `async` function about to do
   * the thing, or not do it.
   */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    const id = ++nextDialogId;
    const data: ConfirmDialogData = {
      ...options,
      titleId: `ewms-dialog-${id}-title`,
      bodyId: `ewms-dialog-${id}-body`,
    };
    const dismissOnBackdrop = backdropDismisses(options.tone);

    const ref = this.dialog.open<boolean, ConfirmDialogData, ConfirmDialog>(ConfirmDialog, {
      ...this.baseConfig<ConfirmDialogData, DialogRef<boolean, ConfirmDialog>>(dismissOnBackdrop),
      data,
      /*
       * The dialog announces its own title and its own body. Both were open
       * questions in the sheet; they are answered here, and dialog.spec.ts
       * asserts the two attributes really resolve to elements that exist.
       */
      ariaLabelledBy: data.titleId,
      ariaDescribedBy: data.bodyId,
    });

    this.wireDismissal(ref, dismissOnBackdrop, false);

    return (await firstClosed(ref)) === true;
  }

  /**
   * Open a component in a dialog -- the form variant of the sheet.
   *
   * Returns the CDK's own reference rather than a promise: a form dialog is
   * not a question, and the consumer usually wants `closed` as a stream, or
   * the component instance, or the ability to close it from outside.
   */
  open<R, D, C>(component: ComponentType<C>, options: OpenDialogOptions<D> = {}): DialogRef<R, C> {
    const dismissOnBackdrop = options.dismissOnBackdrop ?? true;
    const ref = this.dialog.open<R, D, C>(component, {
      ...this.baseConfig<D, DialogRef<R, C>>(dismissOnBackdrop),
      ...(options.data === undefined ? {} : { data: options.data }),
      ...(options.ariaLabel === undefined ? {} : { ariaLabel: options.ariaLabel }),
      ...(options.ariaLabelledBy === undefined ? {} : { ariaLabelledBy: options.ariaLabelledBy }),
    });

    this.wireDismissal(ref, dismissOnBackdrop, undefined);
    return ref;
  }

  /**
   * `disableClose: true` on every dialog, without exception: this service
   * answers Escape and the backdrop itself, because the CDK's one switch
   * cannot tell them apart.
   *
   * `ariaModal` is on. The CDK leaves it off by default because it can clash
   * with overlay components rendered outside the dialog; every overlay in this
   * system is raised from inside the component that owns it, and a modal that
   * does not say it is modal is a modal whose boundary a screen-reader user
   * cannot feel.
   */
  private baseConfig<D, R>(dismissOnBackdrop: boolean): DialogConfig<D, R> {
    return {
      disableClose: true,
      hasBackdrop: true,
      ariaModal: true,
      backdropClass: [...DIALOG_BACKDROP_CLASSES],
      panelClass: [...DIALOG_PANEL_CLASSES],
      // Cancel is the confirmation's first tabbable element, so the keyboard
      // lands on the safe answer.
      autoFocus: 'first-tabbable',
      // Put the focus back where it came from. The sheet asked for this to
      // hold whichever way the dialog closed; the CDK does it for all of them,
      // which is why it is configuration here and not code.
      restoreFocus: true,
      closeOnNavigation: dismissOnBackdrop,
    };
  }

  /**
   * Escape always, the backdrop only when allowed.
   *
   * `closeResult` is what a dismissal produces: `false` for a confirmation,
   * `undefined` for a form dialog -- which is what a consumer reading `closed`
   * expects from "the person did not finish".
   */
  private wireDismissal<R, C>(
    ref: DialogRef<R, C>,
    dismissOnBackdrop: boolean,
    closeResult: R | undefined,
  ): void {
    ref.keydownEvents.subscribe((event) => {
      if (event.key === 'Escape') {
        // Mark it handled, so nothing behind the dialog answers the same key.
        // The toast outlet listens for Escape on the document and checks
        // exactly this before it touches the queue.
        event.preventDefault();
        ref.close(closeResult);
      }
    });

    if (dismissOnBackdrop) {
      ref.backdropClick.subscribe(() => ref.close(closeResult));
    }
  }
}

/** The dialog's single answer, as a promise. */
async function firstClosed<R, C>(ref: DialogRef<R, C>): Promise<R | undefined> {
  return new Promise((resolve) => {
    const subscription = ref.closed.subscribe((result) => {
      subscription.unsubscribe();
      resolve(result);
    });
  });
}
