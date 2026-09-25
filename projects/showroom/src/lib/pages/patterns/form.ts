import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import {
  email,
  form,
  FormField,
  minLength,
  required,
  requiredError,
  validate,
} from '@angular/forms/signals';
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
import { DocTable } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { ESTADO_OPTIONS } from './expedicion-form';
import { numberRange, provideShipmentCodeMessage, shipmentCode } from './expedicion.rules';

const ALMACENES: readonly SelectOption[] = [
  { value: 'central', label: 'Central' },
  { value: 'norte', label: 'Norte' },
];

/** Verificada contra form-pattern.ts. */
const PROPS: readonly PropRow[] = [
  {
    name: '[ewmsForm]',
    type: 'FieldTree<T>',
    default: '— (requerido)',
    description:
      'El árbol del form(). Envío, validación al enviar, resumen de errores y Ctrl+S. Se exporta como ewmsForm.',
  },
  {
    name: '[ewmsFormAction]',
    type: '() => void | Promise<unknown>',
    default: '— (requerido)',
    description:
      'Lo que corre al enviar. submit() la llama solo si el formulario es válido; si devuelve una promesa, el botón queda en carga hasta que resuelva.',
  },
  {
    name: 'busy()',
    type: 'Signal<boolean>',
    default: 'false',
    description:
      'El submitting() del propio formulario: el botón de envío se ata a esto y no hace falta avisar cuando terminó.',
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
    description:
      'Un mensaje por kind (required, minLength, …, más los del proyecto) y las palabras del resumen.',
  },
  {
    name: 'confirmDiscard(form, opciones)',
    type: 'Promise<boolean> | boolean',
    default: '—',
    description: 'Para el canDeactivate del router: pregunta solo si el formulario está sucio.',
  },
];

/** Lo que edita la demo. Los tipos salen de acá y el form() los sigue de extremo a extremo. */
interface AltaExpedicion {
  codigo: string;
  cliente: string;
  correo: string;
  almacen: string;
  fecha: string | null;
  estado: string;
  /** Texto: `ewms-input` entrega lo que el DOM le da, y el DOM da dígitos. */
  bultos: string;
  urgente: boolean;
  etiquetas: boolean;
}

/**
 * /design-system/patterns/form: las reglas del formulario, sobre Signal Forms (ADR 0013). Guarda
 * nada: anota lo que recibió, como el resto de las demos.
 */
@Component({
  selector: 'ewms-showroom-form',
  templateUrl: './form.html',
  imports: [
    Button,
    Checkbox,
    DatePicker,
    DemoFrame,
    DocTable,
    EwmsInput,
    FormField,
    FormPattern,
    PropTable,
    Select,
    Toggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideShipmentCodeMessage()],
})
export class ShowroomForm {
  private readonly injector = inject(Injector);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly almacenes = ALMACENES;
  protected readonly estados = ESTADO_OPTIONS;

  protected readonly model = signal<AltaExpedicion>({
    codigo: '',
    cliente: '',
    correo: '',
    almacen: '',
    fecha: null,
    estado: 'pendiente',
    bultos: '1',
    urgente: false,
    etiquetas: false,
  });

  protected readonly alta = form(this.model, (path) => {
    required(path.codigo);
    // `shipmentCode` es una función de esquema del proyecto, con su `kind` y su mensaje por token.
    shipmentCode(path.codigo);
    required(path.cliente);
    minLength(path.cliente, 3);
    email(path.correo);
    required(path.almacen);
    numberRange(path.bultos, { min: 1, max: 999 });
    // El equivalente de `requiredTrue`: `required` mira si está vacío, y `false` no lo está.
    validate(path.etiquetas, ({ value }) => (value() ? undefined : requiredError()));
  });

  /** Lo último que recibió el consumidor, que acá es esta misma página. */
  protected readonly saved = signal('(todavía nada)');
  protected readonly left = signal('(todavía nada)');

  /**
   * El guardado de verdad tarda; mientras, «Guardar» queda en carga y no se puede pulsar dos
   * veces. Devolver la promesa alcanza: `submit()` mira `submitting()` por su cuenta.
   */
  protected readonly guardar = async (): Promise<void> => {
    const value = this.model();
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.saved.set(`${value.codigo} · ${value.cliente}`);
    // Guardado: deja de estar sucio, así «Salir» no pregunta por nada.
    this.alta().reset(value);
  };

  /**
   * Lo que haría el `canDeactivate` del router: pregunta solo si hay cambios sin guardar.
   * `runInInjectionContext` porque esto sale de un clic y `confirmDiscard` inyecta el diálogo;
   * al `canDeactivate` el router ya se lo da (NG0203 si falta).
   */
  protected async salir(): Promise<void> {
    const leave = await runInInjectionContext(this.injector, () =>
      confirmDiscard(this.alta, {
        title: 'Hay cambios sin guardar',
        body: 'Si salís ahora se pierden. ¿Salir igual?',
        confirmLabel: 'Salir sin guardar',
        cancelLabel: 'Seguir editando',
        tone: 'danger',
      }),
    );
    this.left.set(leave ? 'salió sin guardar' : 'se quedó');
  }

  protected readonly snippet = [
    'alta = form(this.model, (path) => {',
    '  required(path.codigo);',
    '  shipmentCode(path.codigo);   // función de esquema del proyecto',
    '});',
    '',
    '<form [ewmsForm]="alta" [ewmsFormAction]="guardar" #form="ewmsForm">',
    '  <ewms-input label="Código" [formField]="alta.codigo" />',
    '  …',
    '  <ewms-button type="submit" [loading]="form.busy()">Guardar</ewms-button>',
    '</form>',
  ].join('\n');
}
