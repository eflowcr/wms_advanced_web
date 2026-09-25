import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { form as signalForm, FormField } from '@angular/forms/signals';
import { DatePicker, DESIGN_SYSTEM_VERSION, type DatePickerValue } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { TokenValue } from '../../ui/token-value';

/**
 * Verificada contra date-picker.ts.
 * t(showroom.datePicker.props.label, showroom.datePicker.props.mode,
 *   showroom.datePicker.props.limits, showroom.datePicker.props.size,
 *   showroom.datePicker.props.texts)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'label',
    type: 'string',
    default: '—',
    description: 'showroom.datePicker.props.label',
  },
  {
    name: 'mode',
    type: "'single' | 'range'",
    default: "'single'",
    description: 'showroom.datePicker.props.mode',
  },
  {
    name: 'minDate · maxDate',
    type: 'string | null',
    default: 'null',
    description: 'showroom.datePicker.props.limits',
  },
  {
    name: 'size',
    type: "'sm' | 'md' | 'lg'",
    default: "'md'",
    description: 'showroom.datePicker.props.size',
  },
  {
    name: 'placeholder · hint · error',
    type: 'string · boolean',
    default: "'' · false",
    description: 'showroom.datePicker.props.texts',
  },
];

/**
 * t(showroom.datePicker.anatomy.parts.field, showroom.datePicker.anatomy.parts.background,
 *   showroom.datePicker.anatomy.parts.elevation, showroom.datePicker.anatomy.parts.selected,
 *   showroom.datePicker.anatomy.parts.today, showroom.datePicker.anatomy.parts.outOfRange,
 *   showroom.datePicker.anatomy.parts.hover, showroom.datePicker.anatomy.parts.focusRing)
 */
const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'showroom.datePicker.anatomy.parts.field', token: '--color-border-strong' },
  { part: 'showroom.datePicker.anatomy.parts.background', token: '--color-surface' },
  { part: 'showroom.datePicker.anatomy.parts.elevation', token: '--shadow-md' },
  { part: 'showroom.datePicker.anatomy.parts.selected', token: '--color-bg-primary' },
  { part: 'showroom.datePicker.anatomy.parts.today', token: '--color-border-strong' },
  { part: 'showroom.datePicker.anatomy.parts.outOfRange', token: '--color-text-disabled' },
  { part: 'showroom.datePicker.anatomy.parts.hover', token: '--color-ghost-hover' },
  { part: 'showroom.datePicker.anatomy.parts.focusRing', token: '--focus-ring-shadow' },
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
  imports: [DatePicker, FormField, DemoFrame, PropTable, Prose, TokenValue, TranslocoPipe],
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
