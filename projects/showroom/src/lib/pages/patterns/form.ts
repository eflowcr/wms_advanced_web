import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
} from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { translated } from '../../ui/translated';
import { injectStatusOptions } from '../components/shipments';
import { numberRange, provideShipmentCodeMessage, shipmentCode } from './shipment.rules';
import { WAREHOUSES } from './form.fixtures';

/**
 * Verificada contra form-pattern.ts. Lo obligatorio y lo opcional lo dice la descripción: el
 * default es código literal.
 * t(showroom.patternForm.props.form, showroom.patternForm.props.action,
 *   showroom.patternForm.props.busy, showroom.patternForm.props.summary,
 *   showroom.patternForm.props.messages, showroom.patternForm.props.confirmDiscard)
 */
const PROPS: readonly PropRow[] = [
  {
    name: '[ewmsForm]',
    type: 'FieldTree<T>',
    default: '—',
    description: 'showroom.patternForm.props.form',
  },
  {
    name: '[ewmsFormAction]',
    type: '() => void | Promise<unknown>',
    default: '—',
    description: 'showroom.patternForm.props.action',
  },
  {
    name: 'busy()',
    type: 'Signal<boolean>',
    default: 'false',
    description: 'showroom.patternForm.props.busy',
  },
  {
    name: 'summary',
    type: 'boolean',
    default: 'true',
    description: 'showroom.patternForm.props.summary',
  },
  {
    name: 'EWMS_FORM_MESSAGES',
    type: 'token',
    default: '—',
    description: 'showroom.patternForm.props.messages',
  },
  {
    name: 'confirmDiscard(form, options)',
    type: 'Promise<boolean> | boolean',
    default: '—',
    description: 'showroom.patternForm.props.confirmDiscard',
  },
];

/**
 * t(showroom.patternForm.states.columns.moment, showroom.patternForm.states.columns.field,
 *   showroom.patternForm.states.columns.form)
 */
const STATE_COLUMNS: readonly DocColumn[] = [
  { id: 'moment', label: 'showroom.patternForm.states.columns.moment' },
  { id: 'field', label: 'showroom.patternForm.states.columns.field' },
  { id: 'form', label: 'showroom.patternForm.states.columns.form' },
];

/**
 * Los cuatro momentos; la plantilla arma la clave con el momento y la columna.
 * t(showroom.patternForm.states.typing.moment, showroom.patternForm.states.typing.field,
 *   showroom.patternForm.states.typing.form, showroom.patternForm.states.leaving.moment,
 *   showroom.patternForm.states.leaving.field, showroom.patternForm.states.leaving.form,
 *   showroom.patternForm.states.invalid.moment, showroom.patternForm.states.invalid.field,
 *   showroom.patternForm.states.invalid.form, showroom.patternForm.states.valid.moment,
 *   showroom.patternForm.states.valid.field, showroom.patternForm.states.valid.form)
 */
const STATE_ROWS = ['typing', 'leaving', 'invalid', 'valid'] as const;

/**
 * El diálogo de «Salir de la pantalla»; se traduce al abrirlo.
 * t(showroom.patternForm.discard.title, showroom.patternForm.discard.body,
 *   showroom.patternForm.discard.confirm, showroom.patternForm.discard.cancel)
 */
const DISCARD = {
  title: 'showroom.patternForm.discard.title',
  body: 'showroom.patternForm.discard.body',
  confirm: 'showroom.patternForm.discard.confirm',
  cancel: 'showroom.patternForm.discard.cancel',
} as const;

/**
 * Lo que la demo anota: nada todavía, o cómo terminó el intento de salir. La plantilla lo traduce.
 * t(showroom.patternForm.demo.nothingYet, showroom.patternForm.demo.leftWithoutSaving,
 *   showroom.patternForm.demo.stayed)
 */
const OUTCOME = {
  nothingYet: 'showroom.patternForm.demo.nothingYet',
  left: 'showroom.patternForm.demo.leftWithoutSaving',
  stayed: 'showroom.patternForm.demo.stayed',
} as const;

/** Lo que edita la demo. Los tipos salen de acá y el form() los sigue de extremo a extremo. */
interface NewShipment {
  code: string;
  customer: string;
  email: string;
  warehouse: string;
  date: string | null;
  status: string;
  /** Texto: `ewms-input` entrega lo que el DOM le da, y el DOM da dígitos. */
  packages: string;
  urgent: boolean;
  labels: boolean;
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
    Prose,
    Select,
    Toggle,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideShipmentCodeMessage()],
})
export class ShowroomForm {
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly warehouses = WAREHOUSES;
  protected readonly statuses = injectStatusOptions();
  protected readonly stateColumns = STATE_COLUMNS;
  protected readonly stateRows = STATE_ROWS;

  protected readonly model = signal<NewShipment>({
    code: '',
    customer: '',
    email: '',
    warehouse: '',
    date: null,
    status: 'pendiente',
    packages: '1',
    urgent: false,
    labels: false,
  });

  protected readonly newShipment = form(this.model, (path) => {
    required(path.code);
    // `shipmentCode` es una función de esquema del proyecto, con su `kind` y su mensaje por token.
    shipmentCode(path.code);
    required(path.customer);
    minLength(path.customer, 3);
    email(path.email);
    required(path.warehouse);
    numberRange(path.packages, { min: 1, max: 999 });
    // El equivalente de `requiredTrue`: `required` mira si está vacío, y `false` no lo está.
    validate(path.labels, ({ value }) => (value() ? undefined : requiredError()));
  });

  /** Lo último que recibió el consumidor, que acá es esta misma página. */
  protected readonly saved = signal<string | null>(null);
  /** La clave de cómo terminó el último intento de salir. */
  protected readonly left = signal<string>(OUTCOME.nothingYet);

  /** El guardado es un registro y va tal cual; «todavía nada» es texto y sigue al idioma. */
  private readonly nothingYet = translated((t) => t(OUTCOME.nothingYet));
  protected readonly savedText = computed(() => this.saved() ?? this.nothingYet());

  /**
   * El guardado de verdad tarda; mientras, «Guardar» queda en carga y no se puede pulsar dos
   * veces. Devolver la promesa alcanza: `submit()` mira `submitting()` por su cuenta.
   */
  protected readonly save = async (): Promise<void> => {
    const value = this.model();
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.saved.set(`${value.code} · ${value.customer}`);
    // Guardado: deja de estar sucio, así «Salir» no pregunta por nada.
    this.newShipment().reset(value);
  };

  /**
   * Lo que haría el `canDeactivate` del router: pregunta solo si hay cambios sin guardar.
   * `runInInjectionContext` porque esto sale de un clic y `confirmDiscard` inyecta el diálogo;
   * al `canDeactivate` el router ya se lo da (NG0203 si falta).
   */
  protected async leave(): Promise<void> {
    const leave = await runInInjectionContext(this.injector, () =>
      confirmDiscard(this.newShipment, {
        title: this.transloco.translate(DISCARD.title),
        body: this.transloco.translate(DISCARD.body),
        confirmLabel: this.transloco.translate(DISCARD.confirm),
        cancelLabel: this.transloco.translate(DISCARD.cancel),
        variant: 'danger',
      }),
    );
    this.left.set(leave ? OUTCOME.left : OUTCOME.stayed);
  }

  protected readonly snippet = [
    'newShipment = form(this.model, (path) => {',
    '  required(path.code);',
    '  shipmentCode(path.code);   // función de esquema del proyecto',
    '});',
    '',
    '<form [ewmsForm]="newShipment" [ewmsFormAction]="save" #form="ewmsForm">',
    '  <ewms-input label="Código" [formField]="newShipment.code" />',
    '  …',
    '  <ewms-button type="submit" [loading]="form.busy()">Guardar</ewms-button>',
    '</form>',
  ].join('\n');
}
