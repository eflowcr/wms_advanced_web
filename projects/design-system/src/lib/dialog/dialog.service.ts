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

/** Lo que toma `open`: la config del CDK menos todo lo que este servicio maneja. */
export interface OpenDialogOptions<D> {
  readonly data?: D;
  /** Escape sigue cerrando. Esto gobierna solo el fondo. */
  readonly dismissOnBackdrop?: boolean;
  /** El nombre accesible del diálogo, cuando no hay encabezado al que apuntar. */
  readonly ariaLabel?: string;
  /** El id del encabezado dentro del componente. Preferido sobre `ariaLabel`. */
  readonly ariaLabelledBy?: string;
}

/**
 * Diálogos modales sobre `@angular/cdk/dialog`. Del CDK son la trampa de foco, el
 * rol, el fondo inerte y la devolución del foco: cada uno es una pila de casos
 * borde y una versión propia acierta el camino común y falla en los bordes.
 * Acá se agregan las dos formas que toma un diálogo en este sistema: una
 * confirmación, que es una pregunta con dos respuestas y vuelve como promesa, y
 * un formulario, que es un componente del consumidor.
 * EL FONDO NO CIERRA UN DIÁLOGO DESTRUCTIVO: fricción deliberada de la ficha. Se
 * implementa tomando el `disableClose` del CDK -que gobierna Escape Y fondo
 * juntos- y cableando los dos por separado.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);

  /**
   * Pregunta sí/no. Resuelve `true` solo si se pulsó confirmar; Escape, el fondo,
   * Cancelar y un cierre desde afuera resuelven `false`. Promesa y no observable:
   * una confirmación tiene exactamente una respuesta.
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
       * El diálogo anuncia su propio título y su propio cuerpo. Los dos eran
       * preguntas abiertas de la ficha; dialog.spec.ts afirma que los dos atributos
       * resuelven a elementos que existen.
       */
      ariaLabelledBy: data.titleId,
      ariaDescribedBy: data.bodyId,
    });

    this.wireDismissal(ref, dismissOnBackdrop, false);

    return (await firstClosed(ref)) === true;
  }

  /**
   * Abre un componente en un diálogo. Devuelve la referencia del CDK y no una
   * promesa: un formulario no es una pregunta, y el consumidor suele querer
   * `closed` como flujo, la instancia, o poder cerrarlo desde afuera.
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
   * `disableClose: true` siempre, sin excepción: este servicio responde Escape y
   * el fondo por separado porque el único interruptor del CDK no los distingue.
   * `ariaModal` va encendido: un modal que no dice que lo es es un modal cuyo
   * borde no puede sentir quien usa lector de pantalla.
   */
  private baseConfig<D, R>(dismissOnBackdrop: boolean): DialogConfig<D, R> {
    return {
      disableClose: true,
      hasBackdrop: true,
      ariaModal: true,
      backdropClass: [...DIALOG_BACKDROP_CLASSES],
      panelClass: [...DIALOG_PANEL_CLASSES],
      // Cancelar es el primer tabulable de la confirmación, así el teclado
      // aterriza en la respuesta segura.
      autoFocus: 'first-tabbable',
      // Devuelve el foco de donde vino. La ficha lo pedía para las cuatro salidas
      // y el CDK lo hace en todas, por eso es configuración y no código.
      restoreFocus: true,
      closeOnNavigation: dismissOnBackdrop,
    };
  }

  /**
   * Escape siempre, el fondo solo cuando se permite. `closeResult` es lo que
   * produce un descarte: `false` en una confirmación, `undefined` en un
   * formulario.
   */
  private wireDismissal<R, C>(
    ref: DialogRef<R, C>,
    dismissOnBackdrop: boolean,
    closeResult: R | undefined,
  ): void {
    ref.keydownEvents.subscribe((event) => {
      if (event.key === 'Escape') {
        // Marcado como atendido, para que nada detrás del diálogo responda la misma
        // tecla: el outlet de toast escucha Escape en el documento y comprueba esto.
        event.preventDefault();
        ref.close(closeResult);
      }
    });

    if (dismissOnBackdrop) {
      ref.backdropClick.subscribe(() => ref.close(closeResult));
    }
  }
}

/** La única respuesta del diálogo, como promesa. */
async function firstClosed<R, C>(ref: DialogRef<R, C>): Promise<R | undefined> {
  return new Promise((resolve) => {
    const subscription = ref.closed.subscribe((result) => {
      subscription.unsubscribe();
      resolve(result);
    });
  });
}
