import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Fila de la tabla de propiedades. `default` es el literal tal como se tipearía, comillas incluidas. */
export interface PropRow {
  readonly name: string;
  readonly type: string;
  readonly default: string;
  readonly description: string;
}

/**
 * Widget 5.2, tabla de propiedades, estática a propósito (Ver vault: Showroom - Especificacion §5.2).
 * Las filas se verifican contra la firma real del componente; si la ficha difiere, se corrige la ficha.
 */
@Component({
  selector: 'ewms-prop-table',
  templateUrl: './prop-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropTable {
  readonly rows = input.required<readonly PropRow[]>();
  readonly caption = input.required<string>();
}
