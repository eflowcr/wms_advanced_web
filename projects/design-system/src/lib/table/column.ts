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

export interface CellContext<T> {
  readonly $implicit: T;
  readonly value: unknown;
}

/** Salida de emergencia para lo que los cinco tipos no cubren; directiva para que se note. */
@Directive({ selector: '[ewmsCell]' })
export class CellTemplate<T = unknown> {
  readonly template = inject<TemplateRef<CellContext<T>>>(TemplateRef);

  /** Tipa `let-row` y `value` dentro de la plantilla. */
  static ngTemplateContextGuard<T>(
    _directive: CellTemplate<T>,
    _context: unknown,
  ): _context is CellContext<T> {
    return true;
  }
}

/** Declarada, no configurada: no pinta nada, la tabla la consulta y dibuja la grilla. */
@Component({
  selector: 'ewms-column',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableColumn {
  /** Nombre de primer nivel, no camino. También es la clave del filtro y de `aria-sort`. */
  readonly key = input.required<string>();

  /** Ya traducido; vacío es legítimo en `actions`. */
  readonly header = input<string>('');

  /** Decide alineación, tipografía, celda y la forma de su filtro. */
  readonly type = input<TableColumnType>('text');

  readonly width = input<TableColumnWidth>('fill');

  readonly sortable = input<boolean>(false);

  readonly filterable = input<boolean>(false);

  /** Solo en `type="badge"`; `rowState` lee el mismo diccionario. */
  readonly badges = input<BadgeDictionary>({});

  readonly cell = contentChild(CellTemplate);
}
