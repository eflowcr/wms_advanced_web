import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Button } from '../button/button';
import { Checkbox } from '../checkbox/checkbox';
import { Icon } from '../icon/icon';
import { Input as TextInput } from '../input/input';
import { Radio } from '../radio/radio';
import { SplitButton, type SplitAction } from '../split-button/split-button';
import { TABLE_CONTEXT } from './table-context';
import { TablePopover } from './table-popover';
import type { TableDensity } from './table.types';

/**
 * La barra propia de la Tabla: búsqueda, «Filtros», densidad y los chips de los filtros activos,
 * que se ven aunque la fila de filtros esté oculta. Interna. Ver vault: Tabla §12.
 */
@Component({
  selector: 'ewms-table-toolbar',
  templateUrl: './table-toolbar.html',
  imports: [
    Button,
    Checkbox,
    Icon,
    Radio,
    ReactiveFormsModule,
    SplitButton,
    TablePopover,
    TextInput,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col gap-2' },
})
export class TableToolbar {
  protected readonly table = inject(TABLE_CONTEXT);

  /** Principal CSV; alternativas CSV de lo seleccionado (sin selección, deshabilitada) y copiar. */
  protected readonly exportActions = computed<readonly SplitAction[]>(() => [
    {
      id: 'csv-selected',
      label: this.table.text().exportSelected,
      icon: 'file-text',
      disabled: this.table.selectedCount() === 0,
    },
    { id: 'copy', label: this.table.text().copyAll, icon: 'copy' },
  ]);

  protected runExport(id: string): void {
    this.table.runExport(id === 'copy' ? 'copy' : 'csv-selected');
  }

  protected readonly densityControl = new FormControl<TableDensity>(this.table.densityChoice(), {
    nonNullable: true,
  });

  constructor() {
    this.densityControl.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((density) => this.table.setDensity(density));
    // La entrada `density` puede cambiar desde afuera: el radio la sigue sin reemitir.
    effect(() => this.densityControl.setValue(this.table.densityChoice(), { emitEvent: false }));
  }
}
