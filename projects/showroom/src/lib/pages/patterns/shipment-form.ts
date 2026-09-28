import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import {
  Button,
  Input as EwmsInput,
  FormPattern,
  Select,
  Toggle,
} from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { Prose } from '../../ui/prose';
import { injectStatusOptions, type ShipmentStatus } from '../components/shipments';
import { EXAMPLE_CUSTOMER, EXAMPLE_CODE } from './shipment-form.fixtures';
import { provideShipmentCodeMessage, shipmentCode } from './shipment.rules';

/** Lo que edita el formulario; un registro nuevo llega con los campos en blanco. */
export interface ShipmentDraft {
  readonly id: string | null;
  code: string;
  customer: string;
  status: ShipmentStatus;
  urgent: boolean;
}

/**
 * Un solo formulario para crear y editar: dos terminarían con clics distintos (REQ-FE-DS4-003).
 * Patrón Formulario sobre Signal Forms (ADR 0013); Ctrl+S sale del mapa de atajos.
 * Ver vault: Integracion Continua §11.
 */
@Component({
  selector: 'ewms-shipment-form',
  imports: [Button, EwmsInput, FormField, FormPattern, Prose, Select, Toggle, TranslocoPipe],
  templateUrl: './shipment-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  providers: [provideShipmentCodeMessage()],
})
export class ShipmentForm {
  private readonly dialogRef = inject<DialogRef<ShipmentDraft | undefined>>(DialogRef);

  protected readonly titleId = 'ewms-expedicion-form-title';
  protected readonly statuses = injectStatusOptions();
  protected readonly codePlaceholder = EXAMPLE_CODE;
  protected readonly customerPlaceholder = EXAMPLE_CUSTOMER;

  private readonly initial = inject<ShipmentDraft>(DIALOG_DATA);

  protected readonly isNew = this.initial.id === null;

  private readonly model = signal({
    code: this.initial.code,
    customer: this.initial.customer,
    status: this.initial.status as string,
    urgent: this.initial.urgent,
  });

  /** El esquema vive acá: el campo solo dibuja el mensaje del validador que falló. */
  protected readonly newShipment = form(this.model, (path) => {
    // Sin `required`: esta pantalla completa lo que falta («EXP-2026-XXXX», «Sin cliente») y su
    // presupuesto de clics fija guardar en uno (REQ-FE-DS4-003). Lo escrito sí se valida.
    shipmentCode(path.code);
    minLength(path.customer, 3);
  });

  protected readonly save = (): void => {
    const value = this.model();
    this.dialogRef.close({
      id: this.initial.id,
      code: value.code.trim(),
      customer: value.customer.trim(),
      status: value.status as ShipmentStatus,
      urgent: value.urgent,
    });
  };

  // Cancelar, Escape y el fondo cierran sin nada. Sin confirmación aunque haya cambios:
  // REQ-FE-DS4-003 §2.2 fija cancelar en un clic.
  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
