import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import {
  Button,
  Input as EwmsInput,
  FormPattern,
  Select,
  Toggle,
  type SelectOption,
} from '@ewms/design-system';
import type { EstadoExpedicion } from '../components/expediciones';
import { shipmentCode } from './expedicion.rules';

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
 * el patrón (REQ-FE-DS4-003 RFE-05) y dos formularios terminan con clics distintos. Desde el
 * 2026-09-22 sigue el patrón Formulario, sobre Signal Forms (ADR 0013): `[ewmsForm]` valida al
 * salir del campo y al enviar, y Ctrl+S sale del mapa de atajos sin que este componente registre nada.
 */
@Component({
  selector: 'ewms-expedicion-form',
  imports: [Button, EwmsInput, FormField, FormPattern, Select, Toggle],
  templateUrl: './expedicion-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ExpedicionForm {
  private readonly dialogRef = inject<DialogRef<ExpedicionDraft | undefined>>(DialogRef);

  protected readonly titleId = 'ewms-expedicion-form-title';
  protected readonly estados = ESTADO_OPTIONS;

  private readonly initial = inject<ExpedicionDraft>(DIALOG_DATA);

  protected readonly isNew = this.initial.id === null;

  private readonly model = signal({
    codigo: this.initial.codigo,
    cliente: this.initial.cliente,
    estado: this.initial.estado as string,
    urgente: this.initial.urgente,
  });

  /** El esquema vive acá: el campo solo dibuja el mensaje del validador que falló. */
  protected readonly alta = form(this.model, (path) => {
    // Sin `required`: esta pantalla completa lo que falta («EXP-2026-XXXX», «Sin cliente») y su
    // presupuesto de clics fija guardar en uno (REQ-FE-DS4-003). Lo escrito sí se valida.
    shipmentCode(path.codigo);
    minLength(path.cliente, 3);
  });

  protected readonly save = (): void => {
    const value = this.model();
    this.dialogRef.close({
      id: this.initial.id,
      codigo: value.codigo.trim(),
      cliente: value.cliente.trim(),
      estado: value.estado as EstadoExpedicion,
      urgente: value.urgente,
    });
  };

  // Cancelar, Escape y el fondo cierran sin nada. Sin confirmación aunque haya cambios:
  // REQ-FE-DS4-003 §2.2 fija cancelar en un clic.
  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
