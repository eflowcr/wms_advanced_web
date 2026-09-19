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
 * What `DialogService.confirm` renders. NOT PART OF THE PUBLIC API.
 *
 * A consumer never writes this component: they call `confirm()` and get a
 * promise. Exporting it would invite a second way to raise a confirmation,
 * which is how two confirmations in one application end up looking different.
 *
 * The buttons are real `ewms-button`s, not a pair of styled elements. That is
 * the point of a design system having a Button: the focus ring, the loading
 * pattern and the disabled behaviour are decided once.
 *
 * THE IDS ARRIVE IN THE DATA RATHER THAN BEING GENERATED HERE. The container's
 * `aria-labelledby` has to be in the config before the dialog opens, and the
 * config is built by the service -- so the service mints the ids and this
 * template merely uses them. The alternative was to generate them here and
 * reach into the container afterwards through an underscore-prefixed method,
 * which is the CDK's internals and not its API.
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

  /**
   * Cancel closes with `false`, and so does every other way out -- Escape, the
   * backdrop when the tone allows it, and a ref closed with nothing. One
   * answer for "not confirmed", reached four ways.
   */
  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
