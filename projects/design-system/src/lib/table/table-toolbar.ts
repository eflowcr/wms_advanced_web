import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
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
 * La barra propia de la Tabla: buscar · Filtros · Vista · Exportar, y los chips de los filtros
 * activos, que se ven aunque la fila de filtros esté oculta. Interna. Ver vault: Tabla §12 y §22.
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

  /** Los botones con texto no entran en una fila: Filtros y Vista quedan en solo ícono. */
  protected readonly compact = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Lo que piden los botones con texto, medido mientras se ven con texto. */
  private fullWidth = 0;

  private measure(): void {
    const actions = this.host.nativeElement.querySelector<HTMLElement>('[data-toolbar-actions]');
    if (!actions) {
      return;
    }
    if (!this.compact()) {
      const children = [...actions.children] as HTMLElement[];
      const gap = parseFloat(getComputedStyle(actions).columnGap) || 0;
      this.fullWidth = children.reduce(
        (sum, child) => sum + child.getBoundingClientRect().width,
        gap * (children.length - 1),
      );
    }
    const room = this.host.nativeElement.getBoundingClientRect().width;
    this.compact.set(room > 0 && room < this.fullWidth);
  }

  constructor() {
    afterNextRender(() => {
      this.measure();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => this.measure());
        observer.observe(this.host.nativeElement);
        this.destroyRef.onDestroy(() => observer.disconnect());
      }
    });
    this.densityControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((density) => this.table.setDensity(density));
    // La entrada `density` puede cambiar desde afuera: el radio la sigue sin reemitir.
    effect(() => this.densityControl.setValue(this.table.densityChoice(), { emitEvent: false }));
  }
}
