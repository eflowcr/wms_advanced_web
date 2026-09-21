import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import {
  confirmButtonVariant,
  DIALOG_BOX_CLASSES,
  dialogIcon,
  type ConfirmDialogData,
} from './dialog.types';

/**
 * Interno de `DialogService.confirm`: exportarlo invitaría a una segunda forma de confirmar.
 * Los ids llegan en los datos: el CDK los necesita antes de abrir.
 */
@Component({
  selector: 'ewms-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ConfirmDialog {
  protected readonly options = inject<ConfirmDialogData>(DIALOG_DATA);

  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);

  protected readonly boxClasses = DIALOG_BOX_CLASSES;

  protected readonly icon = computed(() => dialogIcon(this.options.tone));

  protected readonly confirmVariant = computed(() => confirmButtonVariant(this.options.tone));

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  /** `false`, igual que Escape, el fondo permitido y una ref cerrada sin nada. */
  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
