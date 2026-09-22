import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ArrayTableSource,
  Banner,
  Button,
  DESIGN_SYSTEM_VERSION,
  DialogService,
  KeyboardShortcuts,
  Select,
  Table,
  TableColumn,
  ToastService,
  type RowActivateEvent,
  type SearchDisplay,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { ESTADOS, EXPEDICIONES, type ExpedicionRow } from '../components/expediciones';
import { FLOW_BUDGETS, type FlowId } from './click-budget';
import { ExpedicionForm, type ExpedicionDraft } from './expedicion-form';
import { ExpedicionSource } from './expedicion-source';

// Solo cabeceras: el árbol se demuestra en la ficha de Tabla; acá sumaría un clic de
// expandir a cada conteo que nada tiene que ver con buscar o editar.
const CABECERAS = EXPEDICIONES.map(({ hijos: _hijos, ...row }) => row);

// Controles cuyo clic avanza un flujo (REQ-FE-DS4-003 §2.1). Abrir un panel o desplegable
// cuenta a propósito: el REQ lo cuenta aunque no sea el paso final.
const FLOW_CONTROLS =
  'button, a[href], input, select, textarea, [role="button"], [role="option"], [role="switch"]';

/**
 * Pantalla ejemplo de REQ-FE-DS4-003 RFE-02: solo compone piezas ya publicadas; el presupuesto
 * se cumple ensamblando el sistema. Ver vault: Patron-Buscar-Crear-Editar.
 */
// Los presupuestos salen de click-budget.ts, igual que en e2e/click-budget.e2e.ts (HG-02).
// El oyente de clics va en el document porque el diálogo vive fuera de este árbol (overlay
// del CDK); la regla de oyente global único es del teclado, y ese sigue siendo del motor.
@Component({
  selector: 'ewms-showroom-search-create-edit',
  imports: [Banner, Button, DemoFrame, Select, Table, TableColumn],
  templateUrl: './search-create-edit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomSearchCreateEdit {
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly shortcuts = inject(KeyboardShortcuts);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly budgets = FLOW_BUDGETS;
  protected readonly estados = ESTADOS;

  /** Las expediciones como estado: guardar una cambia la tabla y la búsqueda. */
  private readonly rows = signal<readonly ExpedicionRow[]>(CABECERAS);

  protected readonly table = computed(
    () => new ArrayTableSource<ExpedicionRow>(this.rows(), ['codigo', 'cliente']),
  );
  protected readonly porId = (row: ExpedicionRow): unknown => row.id;

  protected readonly failing = signal(false);
  protected readonly source = new ExpedicionSource(
    () => this.rows(),
    () => this.failing(),
  );

  /** `code` es contra lo que se compara un código escaneado; nunca se muestra solo. */
  protected readonly display: SearchDisplay<ExpedicionRow> = {
    label: (row) => `${row.codigo} — ${row.cliente}`,
    code: (row) => row.codigo,
  };

  protected readonly chosen = signal<ExpedicionRow | null>(null);
  protected readonly lastSaved = signal<string | null>(null);

  /** Clics reales de puntero sobre controles que avanzan un flujo, desde el último reinicio. */
  protected readonly clicks = signal(0);

  private readonly searchHost = viewChild.required<ElementRef<HTMLElement>>('searchHost');
  private readonly root = viewChild.required<ElementRef<HTMLElement>>('flow');

  protected readonly chosenLabel = computed(() => {
    const row = this.chosen();
    return row === null ? '—' : this.display.label(row);
  });

  constructor() {
    this.shortcuts.register('search', () => this.focusSearch());
    this.shortcuts.register('create', () => this.openForm(null));

    // Un escaneo con el foco fuera del selector (el caso típico en piso de bodega) elige la
    // expedición sin panel y la tabla la sigue. Con foco adentro lo resuelve el propio selector.
    this.shortcuts.scans.pipe(takeUntilDestroyed()).subscribe((code) => this.resolveScan(code));

    const doc = inject(DOCUMENT);
    const onClick = (event: Event): void => this.countClick(event);
    doc.addEventListener('click', onClick, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      doc.removeEventListener('click', onClick, { capture: true }),
    );
  }

  /** Destino de `/`. El campo es un componente: se le pide el input a su host. */
  protected focusSearch(): void {
    this.searchHost().nativeElement.querySelector('input')?.focus();
  }

  protected async openForm(row: ExpedicionRow | null): Promise<void> {
    const draft: ExpedicionDraft = {
      id: row?.id ?? null,
      codigo: row?.codigo ?? '',
      cliente: row?.cliente ?? '',
      estado: row?.estado ?? 'pendiente',
      urgente: false,
    };

    const ref = this.dialogs.open<ExpedicionDraft | undefined, ExpedicionDraft, ExpedicionForm>(
      ExpedicionForm,
      { data: draft, ariaLabelledBy: 'ewms-expedicion-form-title' },
    );

    const result = await new Promise<ExpedicionDraft | undefined>((resolve) => {
      const subscription = ref.closed.subscribe((value) => {
        subscription.unsubscribe();
        resolve(value);
      });
    });

    if (result === undefined) {
      // Cancelado: no se guarda ni se avisa; un toast por «cambiaste de idea» notificaría la nada.
      return;
    }
    this.commit(result);
  }

  /** Edita lo elegido en la búsqueda: el tercer clic del presupuesto de editar. */
  protected editChosen(): void {
    const row = this.chosen();
    if (row !== null) {
      void this.openForm(row);
    }
  }

  /** Fila activada en la tabla: doble clic o Enter sobre la fila enfocada. */
  protected onRowActivate(event: RowActivateEvent<ExpedicionRow>): void {
    this.chosen.set(event.row);
    void this.openForm(event.row);
  }

  protected onChosen(row: ExpedicionRow | null): void {
    this.chosen.set(row);
  }

  protected resetCounter(): void {
    this.clicks.set(0);
  }

  protected toggleFailure(): void {
    this.failing.update((value) => !value);
  }

  private commit(draft: ExpedicionDraft): void {
    const id = draft.id;
    if (id === null) {
      const row: ExpedicionRow = {
        id: `EXP-NEW-${this.rows().length}`,
        nivel: 'cabecera',
        codigo: draft.codigo || 'EXP-2026-XXXX',
        cliente: draft.cliente || 'Sin cliente',
        fecha: '2026-03-01',
        bultos: 0,
        estado: draft.estado,
      };
      this.rows.update((rows) => [row, ...rows]);
      this.chosen.set(row);
    } else {
      this.rows.update((rows) =>
        rows.map((row) =>
          row.id === id
            ? { ...row, codigo: draft.codigo, cliente: draft.cliente, estado: draft.estado }
            : row,
        ),
      );
      this.chosen.set(this.rows().find((row) => row.id === id) ?? null);
    }

    this.lastSaved.set(draft.codigo);
    this.toasts.show('success', `Guardada la expedición ${draft.codigo}.`);
  }

  /** Llegó un código completo: elige la expedición que nombra, o avisa si no hay ninguna. */
  private resolveScan(code: string): void {
    const match = this.rows().find((row) => row.codigo.toLowerCase() === code.trim().toLowerCase());
    if (match === undefined) {
      this.toasts.show('warning', `Ningún registro con el código ${code}.`);
      return;
    }
    this.chosen.set(match);
    this.focusChosenRow(match);
  }

  // Lleva el foco a la fila escaneada. Se busca por el código que muestra y no por índice:
  // la tabla ordena, filtra y pagina, así que la quinta fila del modelo no es la quinta en pantalla.
  private focusChosenRow(row: ExpedicionRow): void {
    const rows = this.root().nativeElement.querySelectorAll<HTMLElement>('tbody [role="row"]');
    for (const element of rows) {
      if (element.textContent?.includes(row.codigo) === true) {
        // La primera celda, no la de `tabindex="0"`: con tabindex rotatorio hay una sola en toda
        // la grilla y casi nunca está en esta fila (la primera versión no enfocaba nada). Cada
        // celda adopta el índice al recibir `(focus)`, así que enfocar una con -1 es válido.
        element.querySelector<HTMLElement>('[role="gridcell"]')?.focus();
        return;
      }
    }
  }

  // Cuenta el clic si avanza un flujo. Va en captura porque varios controles cortan la
  // propagación. Fuera de la demo o del diálogo abierto es cromo del catálogo, no flujo.
  private countClick(event: Event): void {
    // `detail === 0`: activación por teclado, no clic. Desde DS-5 `Enter` envía el formulario
    // con un clic sintético, y sin esto se cobraba un flujo que §2.1 puntúa en cero.
    // Ver vault: REQ-FE-DS4-003 - Minimo de clics.
    if (event instanceof MouseEvent && event.detail === 0) {
      return;
    }

    const target = event.target as Element | null;
    if (target === null || typeof target.closest !== 'function') {
      return;
    }
    if (target.closest('[data-not-a-flow-click]') !== null) {
      return;
    }
    const insideDemo = this.root().nativeElement.contains(target);
    const insideOverlay = target.closest('.cdk-overlay-container') !== null;
    if (!insideDemo && !insideOverlay) {
      return;
    }
    if (target.closest(FLOW_CONTROLS) === null) {
      return;
    }
    this.clicks.update((count) => count + 1);
  }

  protected budgetFor(id: FlowId): number {
    return FLOW_BUDGETS.find((budget) => budget.id === id)?.max ?? 0;
  }
}
