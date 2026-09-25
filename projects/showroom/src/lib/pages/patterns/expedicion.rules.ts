import { inject, type Provider } from '@angular/core';
import { maxError, minError, validate, type SchemaPath } from '@angular/forms/signals';
import { EWMS_FORM_MESSAGES, type FormMessages } from '@ewms/design-system';
import { TranslocoService } from '@jsverse/transloco';

/** EXP-AAAA-NNNN: el código que lleva la etiqueta. */
const CODIGO = /^EXP-\d{4}-\d{4}$/;

/**
 * El `kind` del proyecto para el formato del código. Su texto sale de `EWMS_FORM_MESSAGES` por
 * `kind`, como los nueve de Angular (ADR 0013): lo suma `provideShipmentCodeMessage()`.
 */
export const SHIPMENT_CODE = 'shipmentCode';

/**
 * Clave del scope del catálogo. Constante y marcador, no el literal en translate(): el extractor lo
 * daría por clave del diccionario raíz.
 * t(showroom.form.errors.shipmentCode)
 */
const SHIPMENT_CODE_MESSAGE = 'showroom.form.errors.shipmentCode';

/**
 * Los mensajes de arriba (los del shell, traducidos) más el del `kind` propio, en el componente que
 * usa `shipmentCode()`. Delega con getters: copiar el objeto congelaría el idioma del momento. En un
 * diálogo, «arriba» existe solo si se abre con el `injector` de la pantalla.
 */
export function provideShipmentCodeMessage(): Provider {
  return {
    provide: EWMS_FORM_MESSAGES,
    useFactory: (): FormMessages => {
      const parent = inject(EWMS_FORM_MESSAGES, { skipSelf: true });
      const transloco = inject(TranslocoService);
      const shipmentCode = () => transloco.translate(SHIPMENT_CODE_MESSAGE);
      return {
        get errors() {
          return { ...parent.errors, [SHIPMENT_CODE]: shipmentCode };
        },
        customError: (limit) => parent.customError(limit),
        errorSummary: (count) => parent.errorSummary(count),
        get errorSummaryLabel() {
          return parent.errorSummaryLabel;
        },
        get requiredLegend() {
          return parent.requiredLegend;
        },
      };
    },
  };
}

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
