import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  input,
  TemplateRef,
} from '@angular/core';

/** Etiqueta de un eje de la matriz; la plantilla de celda decide por `id`. */
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
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StateMatrix {
  readonly variants = input.required<readonly MatrixAxis[]>();
  readonly states = input.required<readonly MatrixAxis[]>();
  /** Nombra la tabla para las tecnologías de asistencia. */
  readonly caption = input.required<string>();

  /**
   * Encabezado de la columna de filas. Es entrada porque el eje no siempre son variantes
   * (Texto cruza variante con elemento; Input, estado con tamaño).
   */
  readonly rowHeader = input<string>('Variante');

  readonly cell = contentChild.required<TemplateRef<MatrixCell>>(TemplateRef);
}
