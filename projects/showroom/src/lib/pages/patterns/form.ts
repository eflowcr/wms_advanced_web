import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Button,
  Checkbox,
  confirmDiscard,
  DESIGN_SYSTEM_VERSION,
  DatePicker,
  Input as EwmsInput,
  FormPattern,
  Select,
  Toggle,
  type SelectOption,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { ESTADO_OPTIONS } from './expedicion-form';

const ALMACENES: readonly SelectOption[] = [
  { value: 'central', label: 'Central' },
  { value: 'norte', label: 'Norte' },
];

/** Verificada contra form-pattern.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: 'ewmsForm',
    type: 'directiva sobre <form [formGroup]>',
    default: '—',
    description: 'Envío, validación al enviar, resumen de errores y Ctrl+S. Se exporta como ewmsForm.',
  },
  {
    name: '(formSubmit)',
    type: 'void',
    default: '—',
    description: 'Solo si el formulario es válido. No se llama (submit): ese es el evento nativo.',
  },
  {
    name: 'busy()',
    type: 'Signal<boolean>',
    default: 'false',
    description: 'El botón de envío se ata a esto; vuelve a false cuando el consumidor llama done().',
  },
  {
    name: 'summary',
    type: 'boolean',
    default: 'true',
    description: 'Banner de resumen al enviar con errores. En false, solo los mensajes por campo.',
  },
  {
    name: 'EWMS_FORM_MESSAGES',
    type: 'token',
    default: '— (opcional)',
    description: 'Un mensaje por validador (required, minlength, …, custom) y las palabras del resumen.',
  },
  {
    name: 'confirmDiscard(form, opciones)',
    type: 'Promise<boolean> | boolean',
    default: '—',
    description: 'Para el canDeactivate del router: pregunta solo si el formulario está sucio.',
  },
];

/**
 * /design-system/patterns/form: las reglas del formulario, sobre ReactiveForms y sin reescribir
 * los campos. Guarda nada: anota lo que recibió, como el resto de las demos.
 */
@Component({
  selector: 'ewms-showroom-form',
  templateUrl: './form.html',
  imports: [
    Button,
    Checkbox,
    DatePicker,
    DemoFrame,
    EwmsInput,
    FormPattern,
    PropTable,
    ReactiveFormsModule,
    Select,
    Toggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomForm {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly almacenes = ALMACENES;
  protected readonly estados = ESTADO_OPTIONS;

  protected readonly form = new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^EXP-\d{4}-\d{4}$/)],
    }),
    cliente: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    almacen: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fecha: new FormControl<string | null>(null),
    estado: new FormControl<string>('pendiente', { nonNullable: true }),
    bultos: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.min(1), Validators.max(999)],
    }),
    urgente: new FormControl(false, { nonNullable: true }),
    etiquetas: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  private readonly pattern = viewChild.required(FormPattern);

  /** Lo último que recibió el consumidor, que acá es esta misma página. */
  protected readonly saved = signal('(todavía nada)');
  protected readonly left = signal('(todavía nada)');

  /** El guardado de verdad tarda; mientras, «Guardar» queda en carga y no se puede pulsar dos veces. */
  protected guardar(): void {
    const value = this.form.getRawValue();
    setTimeout(() => {
      this.saved.set(`${value.codigo} · ${value.cliente}`);
      this.pattern().done();
      this.form.markAsPristine();
    }, 600);
  }

  /** Lo que haría el `canDeactivate` del router: pregunta solo si hay cambios sin guardar. */
  protected async salir(): Promise<void> {
    const leave = await confirmDiscard(this.form, {
      title: 'Hay cambios sin guardar',
      body: 'Si salís ahora se pierden. ¿Salir igual?',
      confirmLabel: 'Salir sin guardar',
      cancelLabel: 'Seguir editando',
      tone: 'danger',
    });
    this.left.set(leave ? 'salió sin guardar' : 'se quedó');
  }

  protected readonly snippet = [
    '<form [formGroup]="alta" ewmsForm #form="ewmsForm" (formSubmit)="guardar()">',
    '  <ewms-input label="Código" formControlName="codigo" />',
    '  …',
    '  <ewms-button type="submit" [loading]="form.busy()">Guardar</ewms-button>',
    '</form>',
  ].join('\n');
}
