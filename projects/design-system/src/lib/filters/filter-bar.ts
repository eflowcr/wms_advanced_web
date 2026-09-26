import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  InjectionToken,
  input,
  output,
  signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Button } from '../button/button';
import { DatePicker, type DatePickerValue } from '../date-picker/date-picker';
import { EWMS_DATE_PICKER_MESSAGES } from '../date-picker/date-picker.types';
import { Input as TextInput } from '../input/input';
import { Select, type SelectOption } from '../select/select';
import { DELAY_SEARCH_INPUT_TOKEN } from '../select/select.types';
import { parseTableDate } from '../table/table.tokens';
import type { DateRange } from '../table/table-source';
import { readMilliseconds } from '../tokens/read-token';
import { FilterChips, type FilterChip } from './filter-chips';

/** Lo que vale un filtro de pantalla: un valor elegido, un texto o un período. */
export type FilterFieldValue = string | DateRange;

/** Por clave de campo; una clave ausente es «sin filtro». */
export type FilterValues = Readonly<Record<string, FilterFieldValue>>;

/** Los tres campos del sistema; el tipo decide el control y la forma del valor. */
export type FilterField =
  | { readonly kind: 'select'; readonly key: string; readonly label: string; readonly options: readonly SelectOption[] }
  | { readonly kind: 'date-range'; readonly key: string; readonly label: string }
  | { readonly kind: 'search'; readonly key: string; readonly label: string };

/** Textos ya traducidos, provistos una vez por token (ADR 0008). */
export interface FilterBarMessages {
  /** «Más filtros», o «Más filtros (2)» con filtros activos escondidos. */
  readonly moreFilters: (active: number) => string;
  readonly fewerFilters: string;
}

export const EWMS_FILTER_BAR_MESSAGES = new InjectionToken<FilterBarMessages>(
  'EWMS_FILTER_BAR_MESSAGES',
);

/** Los primeros tres a la vista; el resto detrás de «Más filtros». */
const ALWAYS_VISIBLE = 3;

/** Lo que muestra el campo y lo que sale hacia el filtro, que en la búsqueda llega tarde. */
interface FilterBox {
  readonly value: WritableSignal<string | DatePickerValue>;
  readonly typed: Subject<string | DatePickerValue>;
}

/**
 * Filtros de pantalla: los que no son una columna (almacén, rango del documento, estado del
 * proceso). Van a la fuente, no a la tabla, y no conocen el router: la URL la sincroniza un
 * ayudante de `@ewms/shared`. Aplica al cambiar, sin botón «Aplicar». Ver vault: Patron-Filtros.
 */
@Component({
  selector: 'ewms-filter-bar',
  imports: [Button, DatePicker, FilterChips, Select, TextInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
  templateUrl: './filter-bar.html',
})
export class FilterBar {
  readonly fields = input.required<readonly FilterField[]>();
  readonly value = input<FilterValues>({});

  readonly valueChange = output<FilterValues>();

  private readonly words = inject(EWMS_FILTER_BAR_MESSAGES);
  private readonly dates = inject(EWMS_DATE_PICKER_MESSAGES);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly text = this.words;
  protected readonly expanded = signal(false);

  protected readonly visible = computed(() =>
    this.expanded() ? this.fields() : this.fields().slice(0, ALWAYS_VISIBLE),
  );

  protected readonly hidden = computed(() => this.fields().slice(ALWAYS_VISIBLE));

  /** Cuántos de los escondidos están puestos: el botón lo dice para no esconder un filtro activo. */
  protected readonly hiddenActive = computed(
    () => this.hidden().filter((field) => this.value()[field.key] !== undefined).length,
  );

  private readonly boxes = new Map<string, FilterBox>();

  constructor() {
    // El valor manda: llega de la URL, de un enlace compartido o de «Limpiar filtros».
    effect(() => {
      const values = this.value();
      for (const field of this.fields()) {
        const box = this.box(field);
        const next = values[field.key] ?? (field.kind === 'date-range' ? null : '');
        if (JSON.stringify(box.value() ?? null) !== JSON.stringify(next ?? null)) {
          box.value.set(next as string | DatePickerValue);
        }
      }
    });
  }

  /** Lo que muestra el campo, ya, sin esperar. */
  protected boxValue(field: FilterField): string | DatePickerValue {
    return this.box(field).value();
  }

  /** Lo elegido o tipeado: se ve al instante y filtra tras la espera, si el campo la tiene. */
  protected change(field: FilterField, raw: string | DatePickerValue): void {
    const box = this.box(field);
    box.value.set(raw);
    box.typed.next(raw);
  }

  /** Memorizada: una nueva en cada ciclo borraría lo tipeado. Con espera solo el texto. */
  private box(field: FilterField): FilterBox {
    const existing = this.boxes.get(field.key);
    if (existing) {
      return existing;
    }
    const box: FilterBox = {
      value: signal<string | DatePickerValue>(field.kind === 'date-range' ? null : ''),
      typed: new Subject<string | DatePickerValue>(),
    };
    const delay = field.kind === 'search' ? (readMilliseconds(DELAY_SEARCH_INPUT_TOKEN) ?? 0) : 0;
    const changes = delay > 0 ? box.typed.pipe(debounceTime(delay)) : box.typed;
    changes
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((raw) => this.write(field.key, normalise(raw)));
    this.boxes.set(field.key, box);
    return box;
  }

  protected selectOptions(field: FilterField): readonly SelectOption[] {
    return field.kind === 'select' ? field.options : [];
  }

  private write(key: string, next: FilterFieldValue | undefined): void {
    const values = { ...this.value() };
    if (next === undefined) {
      delete values[key];
    } else {
      values[key] = next;
    }
    this.valueChange.emit(values);
  }

  protected readonly chips = computed<readonly FilterChip[]>(() =>
    this.fields()
      .filter((field) => this.value()[field.key] !== undefined)
      .map((field) => ({
        key: field.key,
        column: field.label,
        value: this.describe(field, this.value()[field.key]!),
      })),
  );

  /** El × de un chip: vacía también su campo, o el campo mentiría. */
  protected remove(key: string): void {
    this.clearBox(key);
    this.write(key, undefined);
  }

  protected clearAll(): void {
    for (const field of this.fields()) {
      this.clearBox(field.key);
    }
    this.valueChange.emit({});
  }

  /** Solo la caja: empujar al `Subject` volvería a filtrar lo que `write` ya resolvió. */
  private clearBox(key: string): void {
    const field = this.fields().find((candidate) => candidate.key === key);
    this.boxes.get(key)?.value.set(field?.kind === 'date-range' ? null : '');
  }

  /** El valor del chip, legible: la etiqueta de la opción, el período con las fechas del idioma. */
  private describe(field: FilterField, value: FilterFieldValue): string {
    if (field.kind === 'select') {
      return (
        field.options.find((option) => String(option.value) === String(value))?.label ??
        String(value)
      );
    }
    if (typeof value === 'string') {
      return value;
    }
    const format = new Intl.DateTimeFormat(this.dates.locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const show = (iso: string | undefined): string => {
      const parsed = iso === undefined ? null : parseTableDate(iso);
      return parsed === null ? '' : format.format(parsed);
    };
    return value.from !== undefined && value.to !== undefined
      ? `${show(value.from)} – ${show(value.to)}`
      : `${show(value.from)}${show(value.to)}`;
  }
}

/** Vacío es «sin filtro», nunca una cadena vacía o un rango sin extremos. */
function normalise(raw: string | DatePickerValue): FilterFieldValue | undefined {
  if (raw === null || raw === undefined) {
    return undefined;
  }
  if (typeof raw === 'string') {
    return raw.trim() === '' ? undefined : raw;
  }
  return raw.from || raw.to ? (raw as DateRange) : undefined;
}
