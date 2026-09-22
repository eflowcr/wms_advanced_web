import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { form as signalForm, FormField } from '@angular/forms/signals';
import { DatePicker, DESIGN_SYSTEM_VERSION, type DatePickerValue } from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { TokenValue } from '../../ui/token-value';

/** Verificada contra date-picker.ts. */
const PROPS: readonly PropRow[] = [
  { name: 'label', type: 'string', default: '— (requerido)', description: 'Visible, unido por for/id.' },
  {
    name: 'mode',
    type: "'single' | 'range'",
    default: "'single'",
    description: "Una fecha 'YYYY-MM-DD', o el DateRange { from, to } de la tabla.",
  },
  {
    name: 'minDate · maxDate',
    type: 'string | null',
    default: 'null',
    description: "'YYYY-MM-DD'. Los días fuera se ven, se recorren y no se eligen.",
  },
  { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", description: 'La caja del Input.' },
  {
    name: 'placeholder · hint · error',
    type: 'string · boolean',
    default: "'' · false",
    description: 'Como en el Input. El hint va por aria-describedby.',
  },
];

const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'Caja del campo', token: '--color-border-strong' },
  { part: 'Fondo del calendario', token: '--color-surface' },
  { part: 'Elevación del calendario', token: '--shadow-md' },
  { part: 'Día elegido', token: '--color-bg-primary' },
  { part: 'Hoy (aro)', token: '--color-border-strong' },
  { part: 'Día fuera del rango', token: '--color-text-disabled' },
  { part: 'Hover de un día', token: '--color-ghost-hover' },
  { part: 'Anillo de foco del día', token: '--focus-ring-shadow' },
];

/** Hoy en la hora local, como lo calcula el componente. */
function today(): string {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
}

/**
 * /design-system/components/date-picker: calendario propio, porque el `<input type="date">`
 * ignora el idioma de la app y no toma tokens.
 */
@Component({
  selector: 'ewms-showroom-date-picker',
  templateUrl: './date-picker.html',
  imports: [DatePicker, FormField, DemoFrame, PropTable, TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomDatePicker {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly today = today();

  protected readonly model = signal<{ entrega: DatePickerValue; periodo: DatePickerValue }>({
    entrega: null,
    periodo: { from: '2026-09-01', to: '2026-09-15' },
  });

  protected readonly form = signalForm(this.model);

  protected readonly delivery = computed(() => this.form.entrega().value());

  protected readonly period = computed(() => this.form.periodo().value());

  protected readonly snippet = [
    '<ewms-date-picker',
    "  [label]=\"'expediciones.entrega' | transloco\"",
    '  [formField]="alta.entrega"',
    '  [minDate]="hoy"',
    '/>',
    '<ewms-date-picker',
    "  [label]=\"'reportes.periodo' | transloco\"",
    '  mode="range"',
    '  [formField]="alta.periodo"',
    '/>',
  ].join('\n');

  protected show(value: DatePickerValue): string {
    return value === null ? 'null' : JSON.stringify(value);
  }
}
