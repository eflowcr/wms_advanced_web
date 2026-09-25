import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DocTable, type DocColumn } from './doc-table';
import { Prose } from './prose';

/**
 * Fila de la tabla de propiedades. `default` es el literal tal como se tipearía, comillas incluidas;
 * `description`, la clave de su texto, que puede llevar marcas de prosa.
 */
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
  imports: [DocTable, Prose, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Debajo de la demo y a ancho completo: al lado quedaba cortada (Select, Date picker). min-w-0:
  // sin él la tabla estira la columna de la grilla y se corta en vez de hacer scroll.
  host: { class: 'col-span-full block min-w-0' },
})
export class PropTable {
  readonly rows = input.required<readonly PropRow[]>();
  readonly caption = input.required<string>();

  /** t(showroom.common.props.name, showroom.common.props.type, showroom.common.props.default, showroom.common.props.description) */
  protected readonly columns: readonly DocColumn[] = [
    { id: 'name', label: 'showroom.common.props.name' },
    { id: 'type', label: 'showroom.common.props.type' },
    { id: 'default', label: 'showroom.common.props.default' },
    { id: 'description', label: 'showroom.common.props.description' },
  ];
}
