import { InjectionToken } from '@angular/core';

/**
 * Los validadores que el sistema nombra. `custom` atiende a cualquier otro: un validador propio
 * escribe su mensaje ahí. Ver vault: Patron-Formulario.
 */
export type FormErrorKey =
  | 'required'
  | 'minlength'
  | 'maxlength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'email'
  | 'custom';

/** Recibe lo que puso el validador (`{ requiredLength: 3 }`) y su nombre. */
export type FormErrorWriter = (detail: unknown, key: string) => string;

/** Textos ya traducidos, provistos una vez por token (ADR 0008). */
export interface FormMessages {
  readonly errors: Readonly<Record<FormErrorKey, FormErrorWriter>>;
  /** Título del resumen al enviar con errores: «Revisá 2 campos». */
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
    minlength: () => '',
    maxlength: () => '',
    min: () => '',
    max: () => '',
    pattern: () => '',
    email: () => '',
    custom: () => '',
  },
  errorSummary: () => '',
  errorSummaryLabel: '',
  requiredLegend: '',
};
