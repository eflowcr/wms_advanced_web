import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  LOCALE_ID,
  model,
  output,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import type { FormValueControl, ValidationError } from '@angular/forms/signals';
import { Button } from '../button/button';
import {
  FIELD_BASE_CLASSES,
  FIELD_FONT_SIZES,
  FIELD_HEIGHT_CLASSES,
  FIELD_PADDING_CLASSES,
  fieldBorderColor,
  fieldSurfaceClasses,
  type FieldSize,
  type FieldState,
} from '../field/field.types';
import { fieldErrorText } from '../forms/field-note';
import { SUFFIX_PADDING_CLASS } from '../input/input.types';
import { createConnectedOverlay, PANEL_POSITIONS } from '../overlay/connected-overlay';
import type { DateRange } from '../table/table-source';
import {
  addDays,
  addMonths,
  DATE_PANEL_CLASSES,
  EWMS_DATE_PICKER_MESSAGES,
  firstDayOfWeek,
  formatDate,
  monthTitle,
  monthWeeks,
  parseDates,
  parseIso,
  toIso,
  RANGE_SEPARATOR,
  weekdayNames,
  weekPosition,
  type CalendarCell,
  type DatePickerMode,
} from './date-picker.types';

export type { DatePickerMessages, DatePickerMode } from './date-picker.types';

export type DatePickerValue = string | DateRange | null;

let nextDatePickerId = 0;

/**
 * Campo con la caja de `ewms-input` y un calendario propio (APG *date picker dialog*): el
 * `<input type="date">` ignora el idioma de la app y no toma tokens. Valor 'YYYY-MM-DD', o el
 * `DateRange` de la tabla. Ver vault: Date-Picker.
 */
@Component({
  selector: 'ewms-date-picker',
  templateUrl: './date-picker.html',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class DatePicker implements FormValueControl<DatePickerValue>, OnDestroy {
  /** Con `[formField]` lo llena el formulario; fuera de uno, `[(value)]`. */
  readonly value = model<DatePickerValue>(null);

  readonly label = input.required<string>();
  readonly mode = input<DatePickerMode>('single');
  /**
   * 'YYYY-MM-DD'; los días fuera del rango se ven y no se eligen. `minDate`/`maxDate` y no
   * `min`/`max`: esos dos nombres son del contrato `FormUiControl`, con otro tipo.
   */
  readonly minDate = input<string | null>(null);
  readonly maxDate = input<string | null>(null);
  readonly size = input<FieldSize>('md');
  readonly placeholder = input<string>('');
  readonly hint = input<string>('');
  /** Solo dibujo, para las demos del catálogo: quien valida es el formulario. */
  readonly error = input<boolean>(false);
  /** Solo para lectores: el filtro de la tabla ya tiene la cabecera de la columna encima. */
  readonly hideLabel = input<boolean>(false);

  // Del contrato `FormValueControl`: el `[formField]` las llena solo. Ninguna que no se lea acá.
  readonly errors = input<readonly ValidationError[]>([]);
  readonly invalid = input<boolean>(false);
  readonly touched = input<boolean>(false);
  readonly required = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  /** Al perder el foco, nunca al ganarlo: el formulario marca «tocado» con esto. */
  readonly touch = output<void>();

  protected readonly words = inject(EWMS_DATE_PICKER_MESSAGES);
  private readonly localeId = inject(LOCALE_ID);
  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef: OverlayRef | null = null;

  private readonly id = ++nextDatePickerId;
  protected readonly fieldId = `ewms-date-picker-${this.id}`;
  protected readonly hintId = `${this.fieldId}-hint`;
  protected readonly dialogId = `${this.fieldId}-dialog`;
  protected readonly titleId = `${this.fieldId}-title`;

  protected readonly panelClasses = DATE_PANEL_CLASSES;
  /** Hoy en la hora local: en UTC, a las 18 h de Costa Rica ya sería mañana. */
  protected readonly today = localToday();

  protected readonly text = signal('');
  protected readonly isOpen = signal(false);
  /** El día con el foco del teclado; decide qué mes se ve. */
  protected readonly focused = signal(this.today);
  /** Primer extremo de un rango, mientras se elige el segundo. */
  protected readonly pendingStart = signal<string | null>(null);

  /** Getter en el shell: se lee en cada uso para seguir al idioma activo. */
  private locale(): string {
    return this.words.locale ?? this.localeId;
  }

  constructor() {
    effect(() => this.text.set(this.format(this.value())));
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  /** Se valida al salir del campo y al enviar, nunca mientras se escribe. */
  protected readonly showError = computed(() => this.invalid() && this.touched());

  protected readonly fieldError = fieldErrorText(this.errors, this.showError);

  protected readonly effectiveState = computed<FieldState>(() =>
    this.disabled() ? 'disabled' : this.error() || this.showError() ? 'error' : 'default',
  );

  /** El mensaje del validador reemplaza al hint, como en el Input. */
  protected readonly note = computed(() => this.fieldError() || this.hint());

  protected readonly borderColor = computed(() =>
    fieldBorderColor(this.effectiveState(), this.isOpen()),
  );

  protected readonly fieldClasses = computed(() =>
    [
      FIELD_BASE_CLASSES,
      FIELD_HEIGHT_CLASSES[this.size()],
      FIELD_PADDING_CLASSES[this.size()],
      SUFFIX_PADDING_CLASS,
      fieldSurfaceClasses(this.effectiveState()),
    ].join(' '),
  );

  protected readonly fontSize = computed(() => FIELD_FONT_SIZES[this.size()]);

  protected readonly weeks = computed(() => monthWeeks(this.focused(), firstDayOfWeek(this.locale())));
  /** El idioma no es una señal: leer `focused` hace que se recalcule al abrir y al moverse. */
  protected readonly weekdays = computed(() => {
    this.focused();
    return weekdayNames(this.locale(), firstDayOfWeek(this.locale()));
  });
  protected readonly title = computed(() => monthTitle(this.focused(), this.locale()));

  private format(value: DatePickerValue): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return formatDate(value, this.locale());
    }
    const from = formatDate(value.from, this.locale());
    const to = formatDate(value.to, this.locale());
    return to ? `${from}${RANGE_SEPARATOR}${to}` : from;
  }

  private range(): DateRange {
    const value = this.value();
    return value !== null && typeof value === 'object' ? value : {};
  }

  protected isOutside(iso: string): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    return (min !== null && iso < min) || (max !== null && iso > max);
  }

  protected isSelected(iso: string): boolean {
    const value = this.value();
    if (this.mode() === 'single') {
      return value === iso;
    }
    const pending = this.pendingStart();
    if (pending) {
      return iso === pending;
    }
    const { from, to } = this.range();
    return from !== undefined && iso >= from && iso <= (to ?? from);
  }

  protected cellClasses(cell: CalendarCell): string {
    const iso = cell.iso!;
    const classes = [
      'h-8 w-8 rounded-control text-center text-caption outline-none',
      'focus-visible:shadow-(--focus-ring-shadow)',
    ];
    if (this.isOutside(iso)) {
      classes.push('text-disabled cursor-not-allowed');
    } else if (this.isSelected(iso)) {
      classes.push('bg-primary text-on-primary cursor-pointer');
    } else {
      classes.push('text-primary hover:bg-ghost-hover cursor-pointer');
    }
    if (iso === this.today) {
      classes.push('border border-strong');
    }
    return classes.join(' ');
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close(true);
    } else {
      this.open();
    }
  }

  private open(): void {
    if (this.disabled()) {
      return;
    }
    const value = this.value();
    const start = typeof value === 'string' ? value : this.range().from;
    this.focused.set(parseIso(start) ? start! : this.clamp(this.today));
    this.pendingStart.set(null);

    this.overlayRef ??= this.createOverlay();
    this.overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);
    this.focusDay();
  }

  private createOverlay(): OverlayRef {
    const overlayRef = createConnectedOverlay(
      this.injector,
      this.anchor().nativeElement,
      PANEL_POSITIONS,
    );
    // El clic en el botón del calendario también es «afuera»; sin excluirlo, el toggle reabre.
    overlayRef.outsidePointerEvents().subscribe((event) => {
      if (!this.anchor().nativeElement.contains(event.target as Node)) {
        this.close(false);
      }
    });
    return overlayRef;
  }

  private close(restoreFocus: boolean): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
    this.pendingStart.set(null);
    if (restoreFocus) {
      this.host.nativeElement.querySelector<HTMLElement>('[data-date-trigger] button')?.focus();
    }
  }

  private clamp(iso: string): string {
    const min = this.minDate();
    const max = this.maxDate();
    return min !== null && iso < min ? min : max !== null && iso > max ? max : iso;
  }

  /** El foco sigue al día activo después de pintar: puede haber cambiado el mes. */
  private focusDay(): void {
    afterNextRender(
      () =>
        this.overlayRef?.overlayElement
          .querySelector<HTMLElement>(`[data-date="${this.focused()}"]`)
          ?.focus(),
      { injector: this.injector },
    );
  }

  private moveFocus(iso: string): void {
    this.focused.set(iso);
    this.focusDay();
  }

  protected moveMonth(delta: number): void {
    this.focused.set(addMonths(this.focused(), delta));
  }

  protected pick(iso: string): void {
    if (this.isOutside(iso)) {
      return;
    }
    this.focused.set(iso);
    if (this.mode() === 'single') {
      this.value.set(iso);
    } else {
      const start = this.pendingStart();
      if (start === null) {
        this.pendingStart.set(iso);
        return;
      }
      this.value.set(start <= iso ? { from: start, to: iso } : { from: iso, to: start });
    }
    this.touch.emit();
    this.close(true);
  }

  /** APG: flechas por día y semana, RePág/AvPág por mes (con Mayús, por año), Inicio/Fin de semana. */
  protected onGridKeydown(event: KeyboardEvent): void {
    const focused = this.focused();
    const firstDay = firstDayOfWeek(this.locale());
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
      Home: () => addDays(focused, -weekPosition(focused, firstDay)),
      End: () => addDays(focused, 6 - weekPosition(focused, firstDay)),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      this.moveFocus(move());
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.pick(focused);
    }
  }

  /** Esc cierra desde cualquier parte del panel; Tab no se escapa del diálogo modal. */
  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const panel = event.currentTarget as HTMLElement;
    const stops = [
      ...panel.querySelectorAll<HTMLElement>('button'),
      panel.querySelector<HTMLElement>(`[data-date="${this.focused()}"]`),
    ].filter((element): element is HTMLElement => element !== null);
    const index = stops.indexOf(document.activeElement as HTMLElement);
    const next = (index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
    event.preventDefault();
    stops[next]?.focus();
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  /** Lo escrito se interpreta en el idioma activo; lo que no es fecha vuelve al valor real. */
  protected commitText(): void {
    const text = this.text().trim();
    const dates = text === '' ? [] : parseDates(text, this.locale());
    const unreadable = text !== '' && dates.length === 0;
    if (unreadable || dates.some((date) => date === null || this.isOutside(date))) {
      this.showValue();
      return;
    }
    const [first, second] = dates as string[];
    if (this.mode() === 'single') {
      this.value.set(first ?? null);
    } else if (first === undefined) {
      this.value.set(null);
    } else {
      const to = second ?? first;
      this.value.set(first <= to ? { from: first, to } : { from: to, to: first });
    }
    this.showValue();
  }

  /** Al DOM también: si el texto vuelve a ser el de antes, el binding no ve cambio y no repinta. */
  private showValue(): void {
    this.text.set(this.format(this.value()));
    this.field().nativeElement.value = this.text();
  }

  protected onFieldKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.commitText();
    } else if (event.key === 'ArrowDown' && event.altKey) {
      event.preventDefault();
      this.open();
    }
  }

  protected onBlur(): void {
    this.commitText();
    this.touch.emit();
  }
}

function localToday(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
