import { Dialog, type DialogConfig, type DialogRef } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { inject, Injectable, type Injector } from '@angular/core';
import { ConfirmDialog } from './confirm-dialog';
import { DialogContainer } from './dialog-container';
import {
  backdropDismisses,
  DIALOG_BACKDROP_CLASSES,
  DIALOG_PANEL_CLASSES,
  type ConfirmDialogData,
  type ConfirmOptions,
} from './dialog.types';

let nextDialogId = 0;

/** La config del CDK menos lo que maneja este servicio. */
export interface OpenDialogOptions<D> {
  readonly data?: D;
  /** Solo el fondo: Escape siempre cierra. */
  readonly dismissOnBackdrop?: boolean;
  /** Cuando no hay encabezado al que apuntar. */
  readonly ariaLabel?: string;
  /** Id del encabezado; preferido sobre `ariaLabel`. */
  readonly ariaLabelledBy?: string;
  /**
   * El inyector de quien abre: el componente ve los textos y servicios de su pantalla. Sin él,
   * solo los de la raíz, y un formulario queda sin los `EWMS_FORM_MESSAGES` que provee el layout.
   */
  readonly injector?: Injector;
}

/**
 * Diálogos sobre `@angular/cdk/dialog` (foco, rol, fondo inerte). El fondo no cierra un
 * destructivo: `disableClose` gobierna Escape y fondo juntos, así que se cablean aparte.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);

  /** `true` solo al confirmar; toda otra salida da `false`. Promesa: hay una sola respuesta. */
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
      // dialog.spec.ts afirma que los dos ids resuelven a elementos existentes.
      ariaLabelledBy: data.titleId,
      ariaDescribedBy: data.bodyId,
    });

    this.wireDismissal(ref, dismissOnBackdrop, false);

    return (await firstClosed(ref)) === true;
  }

  /** Devuelve la referencia del CDK: un formulario no es una pregunta. */
  open<R, D, C>(component: ComponentType<C>, options: OpenDialogOptions<D> = {}): DialogRef<R, C> {
    const dismissOnBackdrop = options.dismissOnBackdrop ?? true;
    const ref = this.dialog.open<R, D, C>(component, {
      ...this.baseConfig<D, DialogRef<R, C>>(dismissOnBackdrop),
      ...(options.data === undefined ? {} : { data: options.data }),
      ...(options.ariaLabel === undefined ? {} : { ariaLabel: options.ariaLabel }),
      ...(options.ariaLabelledBy === undefined ? {} : { ariaLabelledBy: options.ariaLabelledBy }),
      ...(options.injector === undefined ? {} : { injector: options.injector }),
    });

    this.wireDismissal(ref, dismissOnBackdrop, undefined);
    return ref;
  }

  // `disableClose` siempre: el único interruptor del CDK no distingue Escape de fondo.
  private baseConfig<D, R>(dismissOnBackdrop: boolean): DialogConfig<D, R> {
    return {
      // El contenedor propio, sin hoja de componente: la del CDK choca con la CSP (ADR 0010).
      container: DialogContainer,
      disableClose: true,
      hasBackdrop: true,
      ariaModal: true,
      backdropClass: [...DIALOG_BACKDROP_CLASSES],
      panelClass: [...DIALOG_PANEL_CLASSES],
      // Cancelar es el primer tabulable: el teclado cae en la respuesta segura.
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      closeOnNavigation: dismissOnBackdrop,
    };
  }

  /** `closeResult`: `false` en una confirmación, `undefined` en un formulario. */
  private wireDismissal<R, C>(
    ref: DialogRef<R, C>,
    dismissOnBackdrop: boolean,
    closeResult: R | undefined,
  ): void {
    ref.keydownEvents.subscribe((event) => {
      if (event.key === 'Escape') {
        // Atendido: el outlet de toast escucha Escape en el documento y comprueba esto.
        event.preventDefault();
        ref.close(closeResult);
      }
    });

    if (dismissOnBackdrop) {
      ref.backdropClick.subscribe(() => ref.close(closeResult));
    }
  }
}

async function firstClosed<R, C>(ref: DialogRef<R, C>): Promise<R | undefined> {
  return new Promise((resolve) => {
    const subscription = ref.closed.subscribe((result) => {
      subscription.unsubscribe();
      resolve(result);
    });
  });
}
