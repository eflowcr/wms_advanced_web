import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  input,
  TemplateRef,
} from '@angular/core';

/** Una columna: `id` para que la plantilla de celda decida, `label` para el encabezado. */
export interface DocColumn {
  readonly id: string;
  readonly label: string;
}

/** Las dos columnas de «Anatomía y tokens», iguales en toda ficha. */
export const ANATOMY_COLUMNS: readonly DocColumn[] = [
  { id: 'part', label: 'Parte' },
  { id: 'token', label: 'Token, cadena y valor' },
];

/** Lo que recibe la plantilla de una celda: la fila y la columna. */
export interface DocCell<R> {
  readonly $implicit: R;
  readonly column: DocColumn;
}

/**
 * La tabla de documentación del catálogo, y la única `<table>` que se escribe en él: las páginas
 * la usan con una plantilla de celda; la de propiedades y la matriz, también. La primera columna
 * nombra la fila. Ver vault: Showroom - Especificacion §5.
 */
@Component({
  selector: 'ewms-doc-table',
  templateUrl: './doc-table.html',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
})
export class DocTable<R> {
  readonly caption = input.required<string>();
  readonly columns = input.required<readonly DocColumn[]>();
  readonly rows = input.required<readonly R[]>();

  /** La columna que nombra la fila (`<th scope="row">`); si no se dice, la primera. */
  readonly rowHeader = input<string | null>(null);

  /** Una clave por fila, en `data-doc-row`: para quien necesita encontrar una fila. */
  readonly rowKey = input<((row: R) => string) | null>(null);

  /** `middle` para una matriz de componentes; el texto se lee mejor alineado arriba. */
  readonly align = input<'top' | 'middle'>('top');

  /** La plantilla de celda, proyectada: recibe la fila y la columna. */
  protected readonly cell = contentChild.required<TemplateRef<DocCell<R>>>(TemplateRef);

  protected isRowHeader(column: DocColumn, first: boolean): boolean {
    const header = this.rowHeader();
    return header === null ? first : column.id === header;
  }

  protected keyOf(row: R): string | null {
    return this.rowKey()?.(row) ?? null;
  }

  protected readonly alignClass = computed(() =>
    this.align() === 'top' ? 'align-top' : 'align-middle',
  );
}
