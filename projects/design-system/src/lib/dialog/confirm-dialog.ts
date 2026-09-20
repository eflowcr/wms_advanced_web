import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Button } from '../button/button';
import {
  confirmButtonVariant,
  DIALOG_BOX_CLASSES,
  dialogIconClasses,
  type ConfirmDialogData,
} from './dialog.types';

/**
 * Lo que pinta `DialogService.confirm`. NO ES PARTE DE LA API PÚBLICA: un consumidor
 * nunca escribe este componente, llama a `confirm()` y recibe una promesa.
 * Exportarlo invitaría a una segunda forma de levantar una confirmación.
 * Los botones son `ewms-button` de verdad y no un par de elementos estilados: para
 * eso un sistema de diseño tiene un Botón.
 * LOS IDS LLEGAN EN LOS DATOS y no se generan acá: el `aria-labelledby` del
 * contenedor tiene que estar en la config antes de abrir, y la config la arma el
 * servicio.
 */
@Component({
  selector: 'ewms-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ConfirmDialog {
  protected readonly options = inject<ConfirmDialogData>(DIALOG_DATA);

  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);

  protected readonly boxClasses = DIALOG_BOX_CLASSES;

  protected readonly iconClasses = computed(() => dialogIconClasses(this.options.tone));

  protected readonly confirmVariant = computed(() => confirmButtonVariant(this.options.tone));

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  /** Cancelar cierra con `false`, y también lo hacen las otras tres salidas -Escape,
   * el fondo cuando el tono lo permite, y una ref cerrada sin nada-. */
  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
