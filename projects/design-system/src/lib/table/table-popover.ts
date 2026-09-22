import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { Button } from '../button/button';
import type { IconName } from '../../icons/icons.generated';
import { MENU_POSITIONS } from '../menu/menu';
import { createConnectedOverlay } from '../overlay/connected-overlay';

let nextPopoverId = 0;

/**
 * Botón que abre un panel no modal (densidad, columnas, filtro de conjunto). Escape cierra y
 * devuelve el foco al botón; Tab fuera del panel o un clic afuera también cierran. Interna.
 */
@Component({
  selector: 'ewms-table-popover',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <span #anchor class="inline-flex">
      <ewms-button
        variant="secondary"
        size="sm"
        [icon]="icon()"
        [iconOnly]="iconOnly()"
        [label]="iconOnly() ? label() : null"
        [expanded]="isOpen()"
        [controls]="isOpen() ? panelId : null"
        (click)="toggle()"
      >
        {{ label() }}
      </ewms-button>
    </span>
    <ng-template #panel>
      <div
        [id]="panelId"
        role="dialog"
        tabindex="-1"
        class="flex min-w-56 flex-col gap-2 rounded-control border border-default bg-surface p-3 shadow-md outline-none"
        [attr.aria-label]="label()"
        (keydown)="onKeydown($event)"
        (focusout)="onFocusOut($event)"
      >
        <ng-content />
      </div>
    </ng-template>
  `,
})
export class TablePopover {
  readonly label = input.required<string>();
  readonly icon = input<IconName | null>(null);
  readonly iconOnly = input<boolean>(false);

  protected readonly panelId = `ewms-table-popover-${++nextPopoverId}`;
  protected readonly isOpen = signal(false);

  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly anchor = viewChild.required<ElementRef<HTMLElement>>('anchor');
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');
  private overlayRef: OverlayRef | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.overlayRef?.dispose());
  }

  protected toggle(): void {
    if (this.isOpen()) {
      this.close(true);
    } else {
      this.open();
    }
  }

  private open(): void {
    if (!this.overlayRef) {
      this.overlayRef = createConnectedOverlay(
        this.injector,
        this.anchor().nativeElement,
        MENU_POSITIONS,
      );
      this.overlayRef.outsidePointerEvents().subscribe((event) => {
        // El clic en el propio botón lo maneja `toggle`; contarlo como afuera lo reabría.
        if (!this.anchor().nativeElement.contains(event.target as Node)) {
          this.close(false);
        }
      });
    }
    this.overlayRef.attach(new TemplatePortal(this.panel(), this.viewContainerRef));
    this.isOpen.set(true);
    // Al primer control, o al panel si no tiene: el foco entra con quien lo abrió.
    queueMicrotask(() => {
      const root = this.overlayRef?.overlayElement.querySelector<HTMLElement>(`#${this.panelId}`);
      const first = root?.querySelector<HTMLElement>(
        'input:checked, input:not([disabled]), button:not([disabled])',
      );
      (first ?? root)?.focus();
    });
  }

  close(restoreFocus: boolean): void {
    if (!this.isOpen()) {
      return;
    }
    this.overlayRef?.detach();
    this.isOpen.set(false);
    if (restoreFocus) {
      this.anchor().nativeElement.querySelector<HTMLElement>('button')?.focus();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    }
  }

  /** Tab fuera del panel lo cierra: un panel abierto que ya no tiene el foco confunde. */
  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const root = this.overlayRef?.overlayElement;
    if (next !== null && root && !root.contains(next)) {
      this.close(false);
    }
  }
}
