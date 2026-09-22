import { InjectionToken } from '@angular/core';

export type DatePickerMode = 'single' | 'range';

/**
 * Textos ya traducidos, provistos una vez. `locale` es un getter en el shell: LOCALE_ID se fija
 * al arrancar y la app cambia de idioma sin recargar. Sin él se usa LOCALE_ID.
 */
export interface DatePickerMessages {
  readonly chooseDate: string;
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly locale?: string;
}

export const EWMS_DATE_PICKER_MESSAGES = new InjectionToken<DatePickerMessages>(
  'EWMS_DATE_PICKER_MESSAGES',
);

/** Una celda del mes; `iso` null es relleno antes del 1 o después del último día. */
export interface CalendarCell {
  readonly iso: string | null;
  readonly day: number;
}

/** Separador del rango en el campo: raya con espacios, que ningún formato de fecha usa. */
export const RANGE_SEPARATOR = ' – ';

export const DATE_PANEL_CLASSES =
  'flex flex-col gap-2 bg-surface rounded-control shadow-md border border-default p-3';

// ---- Fechas como 'YYYY-MM-DD', sin zona horaria: toda la aritmética en UTC. ----

export function toIso(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10);
}

/** Null si no es una fecha real: '2026-02-30' no pasa. */
export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : date;
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso)!;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** El día se recorta al último del mes: del 31 de enero, un mes adelante es el 28 o 29 de febrero. */
export function addMonths(iso: string, months: number): string {
  const date = parseIso(iso)!;
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0));
  return toIso(target.getUTCFullYear(), target.getUTCMonth() + 1, Math.min(date.getUTCDate(), last.getUTCDate()));
}

/** Posición en la semana, 0 = primer día según el idioma. */
export function weekPosition(iso: string, firstDay: number): number {
  return (parseIso(iso)!.getUTCDay() - firstDay + 7) % 7;
}

/** Semanas del mes de `iso`, empezando por `firstDay` (0 domingo … 6 sábado). */
export function monthWeeks(iso: string, firstDay: number): CalendarCell[][] {
  const date = parseIso(iso)!;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarCell[] = Array.from(
    { length: weekPosition(toIso(year, month, 1), firstDay) },
    () => ({ iso: null, day: 0 }),
  );
  for (let day = 1; day <= days; day += 1) {
    cells.push({ iso: toIso(year, month, day), day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: null, day: 0 });
  }
  return Array.from({ length: cells.length / 7 }, (_unused, week) =>
    cells.slice(week * 7, week * 7 + 7),
  );
}

// ---- Idioma: todo sale de Intl, nada escrito a mano. ----

/** JS cuenta 0 = domingo; Intl, 7. Lunes si el motor no sabe (Firefox sin weekInfo). */
export function firstDayOfWeek(locale: string): number {
  const info = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const firstDay = (info.getWeekInfo?.() ?? info.weekInfo)?.firstDay;
  return firstDay === undefined ? 1 : firstDay % 7;
}

export function weekdayNames(
  locale: string,
  firstDay: number,
): { readonly short: string; readonly long: string }[] {
  const short = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  // 2026-09-20 es domingo: sumarle `firstDay + n` recorre la semana en el orden del idioma.
  return Array.from({ length: 7 }, (_unused, index) => {
    const date = parseIso(addDays('2026-09-20', firstDay + index))!;
    return { short: short.format(date), long: long.format(date) };
  });
}

export function monthTitle(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    parseIso(iso)!,
  );
}

export function formatDate(iso: string | null | undefined, locale: string): string {
  const date = parseIso(iso);
  return date
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date)
    : '';
}

/** Orden de día, mes y año en el idioma: 16/3/2026 en español, 3/16/2026 en inglés. */
function partOrder(locale: string): string[] {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(new Date(Date.UTC(2026, 10, 22)))
    .map((part) => part.type)
    .filter((type) => type === 'day' || type === 'month' || type === 'year');
}

/** Lo que se escribe, en el orden del idioma; cualquier separador vale. Null si no es fecha. */
export function parseDates(text: string, locale: string): (string | null)[] {
  const numbers = text.match(/\d+/g) ?? [];
  const order = partOrder(locale);
  const dates: (string | null)[] = [];
  for (let start = 0; start + 3 <= numbers.length; start += 3) {
    const parts: Record<string, number> = {};
    order.forEach((type, index) => (parts[type] = Number(numbers[start + index])));
    const year = parts['year']! < 100 ? 2000 + parts['year']! : parts['year']!;
    const iso = toIso(year, parts['month']!, parts['day']!);
    // Date.UTC corre el 30 de febrero al 2 de marzo: si no vuelve igual, no era una fecha.
    const written = [year, parts['month']!, parts['day']!]
      .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, '0'))
      .join('-');
    dates.push(iso === written ? iso : null);
  }
  return numbers.length % 3 === 0 ? dates : [null];
}
