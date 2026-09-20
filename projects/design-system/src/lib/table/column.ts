import {
  Component,
  ChangeDetectionStrategy,
  contentChild,
  Directive,
  inject,
  input,
  TemplateRef,
} from '@angular/core';
import type { BadgeDictionary, TableColumnType, TableColumnWidth } from './table.types';

/** Lo que recibe una plantilla `ewmsCell`. */
export interface CellContext<T> {
  readonly $implicit: T;
  readonly value: unknown;
}

/**
 * La salida de emergencia, Y A PROPÓSITO NO EL CAMINO PRINCIPAL. Los cinco tipos
 * de columna cubren lo que una tabla de WMS muestra; esto es para la sexta cosa
 * -una celda con tooltip, un enlace, dos líneas- y es una directiva y no una
 * entrada para que echar mano de ella se vea como lo que es: escribir una plantilla.
 */
@Directive({ selector: '[ewmsCell]' })
export class CellTemplate<T = unknown> {
  readonly template = inject<TemplateRef<CellContext<T>>>(TemplateRef);

  /** Deja que el compilador tipe `let-row` y `value` dentro de la plantilla. */
  static ngTemplateContextGuard<T>(
    _directive: CellTemplate<T>,
    _context: unknown,
  ): _context is CellContext<T> {
    return true;
  }
}

/**
 * Una columna, DECLARADA en vez de configurada. No pinta nada: la tabla las
 * consulta como hijas de contenido y dibuja la grilla. Una columna que pintara sus
 * celdas necesitaría que la tabla le pasara la fila y ella devolviera el ancho, y
 * las dos pelearían por quién es dueña del `<tr>`.
 * Un arreglo de objetos en TypeScript se lee como configuración; seis líneas de
 * marcado se leen como una tabla, en el orden en que van a aparecer.
 */
@Component({
  selector: 'ewms-column',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableColumn {
  /**
   * Qué propiedad de la fila muestra. Un NOMBRE y no un camino: un camino necesita
   * parser, y la salida para algo más profundo ya es `ewmsCell`. Es además la clave
   * con la que viaja su filtro en `TableQuery` y por la que se indexa `aria-sort`.
   */
  readonly key = input.required<string>();

  /** El encabezado, ya traducido. Vacío es legítimo en `actions`. */
  readonly header = input<string>('');

  /** Decide cuatro cosas de una vez: alineación, tipografía, qué celda se dibuja y
   * QUÉ FORMA TOMA SU FILTRO. Una columna numérica filtra con dos números. */
  readonly type = input<TableColumnType>('text');

  readonly width = input<TableColumnWidth>('fill');

  readonly sortable = input<boolean>(false);

  readonly filterable = input<boolean>(false);

  /** Solo para `type="badge"`. EL DICCIONARIO CENTRAL: de él dibuja la insignia, y
   * `rowState` lee el mismo objeto para teñir la fila, así no pueden discrepar. */
  readonly badges = input<BadgeDictionary>({});

  readonly cell = contentChild(CellTemplate);
}
