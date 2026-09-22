import { maxError, minError, validate, type SchemaPath } from '@angular/forms/signals';

/** EXP-AAAA-NNNN: el código que lleva la etiqueta. */
const CODIGO = /^EXP-\d{4}-\d{4}$/;

/**
 * El `kind` del proyecto para el formato del código. Su texto no vive acá: sale de
 * `EWMS_FORM_MESSAGES` por `kind`, como los nueve de Angular (ADR 0013).
 */
export const SHIPMENT_CODE = 'shipmentCode';

/**
 * Función de esquema reutilizable: la usan el formulario del catálogo y el de
 * buscar-crear-editar. Vacío pasa —quien completa es la pantalla—; lo escrito se valida.
 */
export function shipmentCode(path: SchemaPath<string>): void {
  validate(path, ({ value }) =>
    value() === '' || CODIGO.test(value()) ? undefined : { kind: SHIPMENT_CODE },
  );
}

/**
 * Un rango sobre una caja de texto: `ewms-input` entrega dígitos, no números, así que `min` y
 * `max` de Angular no aplican. Los errores son los suyos, y el texto sale del mismo token.
 */
export function numberRange(path: SchemaPath<string>, limits: { min: number; max: number }): void {
  validate(path, ({ value }) => {
    if (value() === '') {
      return undefined;
    }
    const count = Number(value());
    if (count < limits.min) {
      return minError(limits.min);
    }
    return count > limits.max ? maxError(limits.max) : undefined;
  });
}
