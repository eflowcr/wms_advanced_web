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

/** Lo que edita el formulario; un registro nuevo llega con los campos en blanco. */
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
 * Formulario de crear y editar: uno solo para ambos flujos, porque el presupuesto lo garantiza
 * el patrón (REQ-FE-DS4-003 RFE-05) y dos formularios terminan con clics distintos.
 */
// Toma `save` mientras está abierto; el registro muere con el inyector del diálogo y la pantalla
// de atrás lo recupera. `cancel` no se registra: el diálogo del CDK ya cierra con Escape y marca
// el evento como atendido, y el motor saltea lo atendido.
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

  /** El `<form>`, para que Ctrl+S lo envíe en vez de hacer clic en algo. */
  private readonly form = viewChild<ElementRef<HTMLFormElement>>('form');

  constructor() {
    // `requestSubmit()` y no `save()` ni `click()` (DS-5): Enter, el botón y el atajo levantan
    // un único `submit`, y lo que se agregue al envío (validación, guarda) vale para los tres.
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

  // Cancelar, Escape y el fondo cierran sin nada. Sin confirmación aunque haya cambios:
  // REQ-FE-DS4-003 §2.2 fija cancelar en un clic.
  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
