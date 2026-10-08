import { InjectionToken } from '@angular/core';

// Aparte de date-picker.types: el shell provee el token al arrancar y el calendario carga
// con su pantalla. Juntos, toda la aritmética de fechas viajaba en la ruta crítica de `/`.

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
