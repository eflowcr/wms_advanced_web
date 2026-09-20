import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Button,
  Input as EwmsInput,
  KeyboardShortcuts,
  Select,
  Toggle,
  type SelectOption,
} from '@ewms/design-system';
import type { EstadoExpedicion } from '../components/expediciones';

/** What the form edits. A new record arrives with the fields already blank. */
export interface ExpedicionDraft {
  readonly id: string | null;
  codigo: string;
  cliente: string;
  estado: EstadoExpedicion;
  urgente: boolean;
}

export const ESTADO_OPTIONS: readonly SelectOption[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en-proceso', label: 'En proceso' },
  { value: 'completada', label: 'Completada' },
  { value: 'con-incidencia', label: 'Con incidencia' },
];

/**
 * The create/edit form of the example screen.
 *
 * ONE COMPONENT FOR BOTH FLOWS, and that is the point rather than a saving:
 * REQ-FE-DS4-003 RFE-05 says the budget is guaranteed by the PATTERN, and a
 * screen with two different forms is a screen where one of them grows a click
 * the other does not have.
 *
 *
 * IT TAKES OVER `save` AND `cancel` WHILE IT IS OPEN
 *
 * The registrations are withdrawn when this component is destroyed, which is
 * when the dialog closes, so the screen behind it gets them back without
 * either of them knowing about the other. That is the reason `register`
 * returns to the injector's life rather than to a route's.
 *
 * `cancel` is NOT registered here. The CDK's dialog already closes on Escape
 * and marks the event handled, and the engine skips anything already
 * answered -- so Escape closes this and nothing else, in zero clicks. A
 * registration would have been a second answer to the same key.
 */
@Component({
  selector: 'ewms-expedicion-form',
  imports: [Button, EwmsInput, FormsModule, Select, Toggle],
  templateUrl: './expedicion-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ExpedicionForm {
  private readonly dialogRef = inject<DialogRef<ExpedicionDraft | undefined>>(DialogRef);
  private readonly shortcuts = inject(KeyboardShortcuts);

  protected readonly titleId = 'ewms-expedicion-form-title';
  protected readonly estados = ESTADO_OPTIONS;

  private readonly initial = inject<ExpedicionDraft>(DIALOG_DATA);

  protected readonly isNew = this.initial.id === null;
  protected readonly codigo = signal(this.initial.codigo);
  protected readonly cliente = signal(this.initial.cliente);
  protected readonly estado = signal<string>(this.initial.estado);
  protected readonly urgente = signal(this.initial.urgente);

  /** The `<form>` itself, so Ctrl+S can submit it rather than click something. */
  private readonly form = viewChild<ElementRef<HTMLFormElement>>('form');

  constructor() {
    /*
     * `requestSubmit()` AND NOT `save()`, since DS-5.
     *
     * Ctrl+S used to call the method directly, because there was no submit
     * button to press. Now that there is one, going through the FORM is what
     * keeps the three gestures on one path: `Enter` in a field, the button,
     * and the shortcut all raise one `submit` event, and anything that is ever
     * added to submission -- validation, a guard, a confirm -- applies to all
     * three at once. `requestSubmit()` and not `click()` for the same reason:
     * clicking a button is a way to submit, not the submission itself.
     */
    this.shortcuts.register('save', () => this.form()?.nativeElement.requestSubmit());
  }

  protected save(): void {
    this.dialogRef.close({
      id: this.initial.id,
      codigo: this.codigo().trim(),
      cliente: this.cliente().trim(),
      estado: this.estado() as EstadoExpedicion,
      urgente: this.urgente(),
    });
  }

  /**
   * Cancel closes with nothing, and so does Escape and so does the backdrop.
   *
   * NO CONFIRMATION, even with the fields changed. REQ-FE-DS4-003 §2.2 is
   * explicit: cancelling costs one click and a screen that asks you to confirm
   * the cancellation of something never saved is spending the budget on a
   * question.
   */
  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
