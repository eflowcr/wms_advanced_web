import { computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import type { Observable } from 'rxjs';
import type { DatePickerValue } from '../date-picker/date-picker';
import type { FilterChip } from '../filters/filter-chips';
import type { TableColumn } from './column';
import { isDateRange, isNumberRange, isSetFilter, type TableFilterValue } from './table-source';
import type { TableFormatters } from './table.tokens';

export type FilterBound = 'text' | 'min' | 'max';


interface FiltersHost {
  readonly columns: () => readonly TableColumn[];
  readonly format: () => TableFormatters;
  /** Con espera por token para lo tipeado; sin token, directo. */
  readonly typed: (source: Observable<string>) => Observable<string>;
  /** Cualquier cambio vuelve a la página 0. */
  readonly changed: () => void;
  /** El chip de un conjunto vacío. */
  readonly none: () => string;
}

/**
 * Los filtros de columna de la Tabla: controles memorizados, el valor de cada uno y sus chips.
 * Interna; se crea en el contexto de inyección de la tabla. Ver vault: Tabla §12.
 */
export class TableFilters {
  readonly values = signal<Readonly<Record<string, TableFilterValue>>>({});

  readonly count = computed(() => Object.keys(this.values()).length);

  readonly chips = computed<readonly FilterChip[]>(() => {
    const values = this.values();
    return this.host
      .columns()
      .filter((column) => values[column.key()] !== undefined)
      .map((column) => ({
        key: column.key(),
        column: column.header() || column.key(),
        value: this.describe(column, values[column.key()]!),
      }));
  });

  private readonly destroyRef = inject(DestroyRef);

  // Memorizados: la plantilla los pide en cada ciclo y uno nuevo borraría lo tipeado.
  private readonly textControls = new Map<string, FormControl<string>>();
  private readonly dateControls = new Map<string, FormControl<DatePickerValue>>();

  constructor(private readonly host: FiltersHost) {}

  control(column: TableColumn, bound: FilterBound): FormControl<string> {
    const id = `${column.key()}:${bound}`;
    const existing = this.textControls.get(id);
    if (existing) {
      return existing;
    }
    const control = new FormControl('', { nonNullable: true });
    this.host
      .typed(control.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.onTyped(column, bound, value));
    this.textControls.set(id, control);
    return control;
  }

  /** La fecha es un solo campo de rango: el date picker ya entrega el `DateRange`. */
  dateControl(column: TableColumn): FormControl<DatePickerValue> {
    const existing = this.dateControls.get(column.key());
    if (existing) {
      return existing;
    }
    const control = new FormControl<DatePickerValue>(null);
    control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      const range = value !== null && typeof value === 'object' ? value : null;
      this.write(column.key(), range && (range.from || range.to) ? range : undefined);
    });
    this.dateControls.set(column.key(), control);
    return control;
  }

  write(key: string, value: TableFilterValue | undefined): void {
    this.host.changed();
    this.values.update((current) => {
      const next = { ...current };
      if (value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  /** El × del chip: vacía también las cajas, o la fila de filtros mentiría al abrirse. */
  clear(key: string): void {
    for (const bound of ['text', 'min', 'max'] as const) {
      this.textControls.get(`${key}:${bound}`)?.setValue('', { emitEvent: false });
    }
    this.dateControls.get(key)?.setValue(null, { emitEvent: false });
    this.write(key, undefined);
  }

  /** Sin filtro, todas pasan: un conjunto ausente es «todas marcadas». */
  isChosen(column: TableColumn, option: string): boolean {
    const value = this.values()[column.key()];
    return value === undefined || !isSetFilter(value) || value.includes(option);
  }

  /** Para «Todos»: marcado, indeterminado o vacío. */
  setState(column: TableColumn): 'all' | 'some' | 'none' {
    const value = this.values()[column.key()];
    if (value === undefined || !isSetFilter(value)) {
      return 'all';
    }
    return value.length === 0 ? 'none' : 'some';
  }

  /** Con todas marcadas otra vez el filtro se borra: «todas» no es un filtro. */
  toggleOption(column: TableColumn, option: string): void {
    const all = Object.keys(column.badges());
    const chosen = new Set(all.filter((key) => this.isChosen(column, key)));
    if (chosen.has(option)) {
      chosen.delete(option);
    } else {
      chosen.add(option);
    }
    // En el orden del diccionario, no en el de los clics: el chip se lee igual siempre.
    this.write(
      column.key(),
      chosen.size === all.length ? undefined : all.filter((key) => chosen.has(key)),
    );
  }

  /** «Todos» desmarcado es ninguna: la tabla queda vacía, como la pidió quien lo desmarcó. */
  toggleAll(column: TableColumn): void {
    this.write(column.key(), this.setState(column) === 'all' ? [] : undefined);
  }

  clearAll(): void {
    for (const key of Object.keys(this.values())) {
      this.clear(key);
    }
  }

  private onTyped(column: TableColumn, bound: FilterBound, raw: string): void {
    if (bound === 'text') {
      this.write(column.key(), raw.trim() === '' ? undefined : raw);
      return;
    }

    const current = this.values()[column.key()];
    const base: Record<string, unknown> =
      current !== undefined && isNumberRange(current) ? { ...current } : {};

    if (raw.trim() === '') {
      // Vacía es sin límite, no cero: leerla como 0 tiraría filas en silencio.
      delete base[bound];
    } else {
      base[bound] = column.type() === 'number' ? Number(raw) : raw;
    }

    this.write(
      column.key(),
      Object.keys(base).length === 0 ? undefined : (base as TableFilterValue),
    );
  }

  /** El valor del chip, en el formato de la columna. */
  private describe(column: TableColumn, filter: TableFilterValue): string {
    const format = this.host.format();
    if (isSetFilter(filter)) {
      const badges = column.badges();
      return filter.length === 0
        ? this.host.none()
        : filter.map((key) => badges[key]?.label ?? key).join(', ');
    }
    if (isNumberRange(filter)) {
      return bounds(filter.min, filter.max, format.number);
    }
    if (isDateRange(filter)) {
      return bounds(filter.from, filter.to, format.date);
    }
    return String(filter);
  }
}

/** «100 – 900», «≥ 100» o «≤ 900»: un límite ausente no se escribe. */
function bounds(from: unknown, to: unknown, show: (value: unknown) => string): string {
  if (from !== undefined && to !== undefined) {
    return `${show(from)} – ${show(to)}`;
  }
  return from !== undefined ? `≥ ${show(from)}` : `≤ ${show(to)}`;
}
