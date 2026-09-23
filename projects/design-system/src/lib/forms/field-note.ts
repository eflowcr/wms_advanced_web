import { computed, inject, type Signal } from '@angular/core';
import type { ValidationError } from '@angular/forms/signals';
import { EWMS_FORM_MESSAGES, NO_FORM_MESSAGES, type FormErrorKind } from './form.types';

let nextNoteId = 0;

/** Un id por campo para el `<p>` del mensaje, al que apunta `aria-describedby`. */
export function fieldNoteId(prefix: string): string {
  return `${prefix}-note-${++nextNoteId}`;
}

/**
 * El texto del primer error: el `message` del validador si lo trae, si no el del token por
 * `kind`. Vacío mientras `show` sea falso. Ver vault: Patron-Formulario.
 */
export function fieldErrorText(
  errors: Signal<readonly ValidationError[]>,
  show: Signal<boolean>,
): Signal<string> {
  const words = inject(EWMS_FORM_MESSAGES, { optional: true }) ?? NO_FORM_MESSAGES;
  return computed(() => {
    const error = show() ? errors()[0] : undefined;
    if (error === undefined) {
      return '';
    }
    if (error.message !== undefined && error.message !== '') {
      return error.message;
    }
    // El límite viaja en la propiedad que se llama como el `kind`: `min` en `min`, `maxLength`
    // en `maxLength`. Es el contrato de las clases de error de Angular 22.1.6.
    const limit = (error as unknown as Record<string, unknown>)[error.kind];
    return (words.errors[error.kind as FormErrorKind] ?? words.customError)(limit);
  });
}
