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
import { FormsModule } from '@angular/forms';
import {
  ArrayTableSource,
  Banner,
  Button,
  DESIGN_SYSTEM_VERSION,
  DialogService,
  KeyboardShortcuts,
  SearchSelect,
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

/**
 * Only the headers. The table's own sheet is where the three-level tree is
 * demonstrated; here the subject is the FLOW, and a tree would add an expand
 * click to every count that has nothing to do with searching or editing.
 */
const CABECERAS = EXPEDICIONES.map(({ hijos: _hijos, ...row }) => row);

/**
 * Controls whose click ADVANCES a flow, per §2.1 of REQ-FE-DS4-003.
 *
 * Opening a panel or a dropdown is on the list on purpose: the REQ counts it
 * even though it is not the final step, and a counter that quietly forgave it
 * would be a counter that always agreed with the budget.
 */
const FLOW_CONTROLS =
  'button, a[href], input, select, textarea, [role="button"], [role="option"], [role="switch"]';

/**
 * /design-system/patterns/search-create-edit -- THE EXAMPLE SCREEN
 * (REQ-FE-DS4-003 RFE-02), and the composition the comanda's step 6 asks for.
 *
 * NOTHING NEW IS BUILT HERE. Every part is a component that already shipped:
 * `ewms-search-select` from DS-3, `ewms-table` from DS-3, `DialogService`,
 * `ToastService`, `ewms-banner`, and the shortcut engine from DS-4. That is
 * the claim the page exists to make -- that the budget is met by ASSEMBLING
 * the system, not by a screen solving it again.
 *
 *
 * THE COUNTER COUNTS REAL CLICKS, AND IT IS THE SAME NUMBER THE TEST ASSERTS
 *
 * RFE-04 asks the screen to show its own count, and HG-02 asks the screen and
 * the test to read the budget from one place. Both do: the numbers come from
 * `click-budget.ts`, and `e2e/click-budget.e2e.ts` walks these same flows with
 * its own counter and compares against the same constants. A count the page
 * computed for itself, or a test that hard-coded a 2, would each be a way of
 * agreeing with a budget nobody checked.
 *
 * The listener is on the DOCUMENT and not on this component's root, because a
 * dialog renders in the CDK's overlay container OUTSIDE this tree -- and the
 * clicks on Guardar and Cancelar are exactly the ones the create and cancel
 * budgets are about. It is a click listener; the rule about a single global
 * listener is about the KEYBOARD, and that one still belongs to the engine.
 */
@Component({
  selector: 'ewms-showroom-search-create-edit',
  imports: [Banner, Button, DemoFrame, FormsModule, SearchSelect, Table, TableColumn],
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

  /** The shipments, as state: saving one changes the table AND the search. */
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

  /** `code` is what a scanned barcode is matched against, and is never shown alone. */
  protected readonly display: SearchDisplay<ExpedicionRow> = {
    label: (row) => `${row.codigo} — ${row.cliente}`,
    code: (row) => row.codigo,
  };

  protected readonly chosen = signal<ExpedicionRow | null>(null);
  protected readonly lastSaved = signal<string | null>(null);

  /** Real mouse clicks on controls that advance a flow, since the last reset. */
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

    /*
     * A scan chooses the shipment WITHOUT the panel, and the table follows.
     *
     * The search select resolves the scan itself when the focus is in it; this
     * subscription is for the other case, which is the one that matters on a
     * warehouse floor: the gun is fired with the focus nowhere in particular,
     * and the screen still has to land on the right record.
     */
    this.shortcuts.scans.pipe(takeUntilDestroyed()).subscribe((code) => this.resolveScan(code));

    const doc = inject(DOCUMENT);
    const onClick = (event: Event): void => this.countClick(event);
    doc.addEventListener('click', onClick, { capture: true });
    inject(DestroyRef).onDestroy(() =>
      doc.removeEventListener('click', onClick, { capture: true }),
    );
  }

  /** `/` lands here. The field is a component, so the page asks its host for the input. */
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
      // Cancelled. Nothing is saved and nothing is said: a toast for "you
      // changed your mind" is a notification about the absence of an event.
      return;
    }
    this.commit(result);
  }

  /** Editing what the search chose. The third click of the edit budget. */
  protected editChosen(): void {
    const row = this.chosen();
    if (row !== null) {
      void this.openForm(row);
    }
  }

  /** A row activated in the table -- double click, or Enter on the focused row. */
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

  /**
   * A whole code arrived. Choose the shipment it names; say so if it names none.
   *
   * A banner and not a toast for the miss: an unknown code is a condition that
   * stays true until somebody does something about it, and a message that
   * disappears in three seconds is the wrong shape for that. The Toast's own
   * sheet says exactly this.
   */
  private resolveScan(code: string): void {
    const match = this.rows().find((row) => row.codigo.toLowerCase() === code.trim().toLowerCase());
    if (match === undefined) {
      this.toasts.show('warning', `Ningún registro con el código ${code}.`);
      return;
    }
    this.chosen.set(match);
    this.focusChosenRow(match);
  }

  /**
   * The table takes the focus to the scanned row, so the eye lands where the
   * gun did.
   *
   * The row is found by the code it SHOWS rather than by an index into the
   * model: the table sorts, filters and pages, so the fifth row of the data is
   * not reliably the fifth row on screen. Matching what is rendered is the
   * only reading that stays true.
   */
  private focusChosenRow(row: ExpedicionRow): void {
    const rows = this.root().nativeElement.querySelectorAll<HTMLElement>('tbody [role="row"]');
    for (const element of rows) {
      if (element.textContent?.includes(row.codigo) === true) {
        /*
         * The FIRST CELL, and not the one carrying `tabindex="0"`.
         *
         * The table is a treegrid with a roving tabindex: exactly one cell in
         * the whole grid is tabbable at a time, and it is wherever the keyboard
         * was left -- so inside any other row there is no `tabindex="0"` to
         * find. That is what the first version of this looked for, and it
         * silently focused nothing. Each cell answers `(focus)` by adopting the
         * roving index, so focusing a `tabindex="-1"` cell directly is both
         * allowed and what moves the grid's idea of "here".
         */
        element.querySelector<HTMLElement>('[role="gridcell"]')?.focus();
        return;
      }
    }
  }

  /**
   * One click, counted if it advances a flow.
   *
   * `capture: true` so a control that stops propagation -- and several do, on
   * purpose -- is still counted. Clicks outside the demo region and outside an
   * open dialog are the catalogue's own chrome and are not part of any flow;
   * so is the counter's own reset button, which would otherwise make resetting
   * cost a click.
   */
  private countClick(event: Event): void {
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
