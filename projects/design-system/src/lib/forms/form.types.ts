import { InjectionToken } from '@angular/core';

/**
 * Los `kind` que trae Angular (`@angular/forms/signals` 22.1.6). Faltan a propósito `parse`, que
 * solo emite un `<input type="number">` nativo, y `standardSchema`, que no se usa.
 */
export type FormErrorKind =
  | 'required'
  | 'min'
  | 'max'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'email'
  | 'minDate'
  | 'maxDate';

/** Recibe el límite que puso el validador (`minLength: 3` llega con `3`); `required`, nada. */
export type FormErrorWriter = (limit: unknown) => string;

/**
 * Por `kind`. Los nueve de Angular son obligatorios; un validador del proyecto agrega el suyo,
 * o trae su texto en el `message` del error, que gana sobre esta tabla.
 */
export type FormErrorWriters = Readonly<Record<FormErrorKind, FormErrorWriter>> &
  Readonly<Partial<Record<string, FormErrorWriter>>>;

/** Textos ya traducidos, provistos una vez por token (ADR 0008). */
export interface FormMessages {
  readonly errors: FormErrorWriters;
  /** Un `kind` que la tabla no nombra y cuyo error no trae `message`. */
  readonly customError: FormErrorWriter;
  /** Título del resumen al enviar con errores: «Revise 2 campos». */
  readonly errorSummary: (count: number) => string;
  /** Nombre de la severidad del resumen, que ningún texto repite (WCAG 1.4.1). */
  readonly errorSummaryLabel: string;
  /** Una vez por formulario, junto al primer campo obligatorio. */
  readonly requiredLegend: string;
}

export const EWMS_FORM_MESSAGES = new InjectionToken<FormMessages>('EWMS_FORM_MESSAGES');

/** Sin proveedor el formulario funciona igual; solo queda mudo (como el Select). */
export const NO_FORM_MESSAGES: FormMessages = {
  errors: {
    required: () => '',
    min: () => '',
    max: () => '',
    minLength: () => '',
    maxLength: () => '',
    pattern: () => '',
    email: () => '',
    minDate: () => '',
    maxDate: () => '',
  },
  customError: () => '',
  errorSummary: () => '',
  errorSummaryLabel: '',
  requiredLegend: '',
};
