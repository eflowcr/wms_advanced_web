import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  input,
  TemplateRef,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DocTable, type DocColumn } from './doc-table';

/** Un eje de la matriz: `label` es la clave del texto; la plantilla de celda decide por `id`. */
export interface MatrixAxis {
  readonly id: string;
  readonly label: string;
}

/** Lo que recibe la plantilla de una celda. */
export interface MatrixCell {
  readonly variant: MatrixAxis;
  readonly state: MatrixAxis;
}

/**
 * Widget 5.1, matriz de estados: una tabla real, con estados en columnas y variantes en filas.
 * No fuerza ningún estado: `:hover` y `:focus-visible` los fuerza cada página con la utilidad
 * del mismo token que usa el componente, junto al componente que describe.
 */
@Component({
  selector: 'ewms-state-matrix',
  templateUrl: './state-matrix.html',
  imports: [DocTable, NgTemplateOutlet, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateMatrix {
  readonly variants = input.required<readonly MatrixAxis[]>();
  readonly states = input.required<readonly MatrixAxis[]>();
  /** Nombra la tabla para las tecnologías de asistencia. */
  readonly caption = input.required<string>();

  /**
   * Clave del encabezado de la columna de filas. Es entrada porque el eje no siempre son variantes
   * (Texto cruza variante con elemento; Input, estado con tamaño).
   * t(showroom.common.matrix.variant)
   */
  readonly rowHeader = input<string>('showroom.common.matrix.variant');

  readonly cell = contentChild.required<TemplateRef<MatrixCell>>(TemplateRef);

  /** La columna que nombra la fila; un id vacío no choca con el de ningún estado. */
  protected readonly rowColumn = '';

  protected readonly columns = computed<readonly DocColumn[]>(() => [
    { id: this.rowColumn, label: this.rowHeader() },
    ...this.states(),
  ]);
}
