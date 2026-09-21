import { type OverlayRef } from '@angular/cdk/overlay';
import { DomPortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  Directive,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  input,
  type OnDestroy,
} from '@angular/core';
import { createConnectedOverlay } from '../overlay/connected-overlay';
import {
  TOOLTIP_CLASSES,
  TOOLTIP_POINTER_GRACE_MS,
  TOOLTIP_POSITIONS,
  TOOLTIP_SHOW_DELAY_MS,
  type TooltipPosition,
} from './tooltip.types';

export type { TooltipPosition } from './tooltip.types';

let nextTooltipId = 0;

/** Uno abierto por página: el ámbito de módulo lo garantiza entre instancias que no se conocen. */
let openTooltip: Tooltip | null = null;

/** Devuelve quién tenía el lugar. */
function claimSingleton(instance: Tooltip): Tooltip | null {
  const previous = openTooltip;
  openTooltip = instance;
  return previous;
}

/** Solo si `instance` sigue teniendo el lugar. */
function releaseSingleton(instance: Tooltip): void {
  if (openTooltip === instance) {
    openTooltip = null;
  }
}

/**
 * Describe, no nombra (por eso el botón de solo ícono exige `label`). WCAG 2.2 1.4.13: Escape lo
 * descarta, el puntero puede entrar y nunca cierra por tiempo. Ver vault: Tooltip.
 */
@Directive({
  selector: '[ewmsTooltip]',
})
export class Tooltip implements OnDestroy {
  /** Ya traducido (ADR 0008). */
  readonly text = input.required<string>({ alias: 'ewmsTooltip' });

  readonly position = input<TooltipPosition>('top');

  /** True si el texto agrega algo al nombre; en false el panel va `aria-hidden` para no repetirlo. */
  readonly describes = input<boolean>(false);

  /** No `disabled`: capturaría el `[disabled]` del host, que quedaría clicable. Ver vault: Tooltip. */
  readonly tooltipDisabled = input<boolean>(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  private readonly panelId = `ewms-tooltip-${++nextTooltipId}`;

  private overlayRef: OverlayRef | null = null;
  private panel: HTMLElement | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pointerInsidePanel = false;

  constructor() {
    // Apagarla cierra el panel; un texto nuevo se refleja en el panel abierto.
    effect(() => {
      if (this.tooltipDisabled()) {
        this.hide();
        return;
      }
      const text = this.text();
      if (this.panel) {
        this.panel.textContent = text;
      }
    });
  }

  ngOnDestroy(): void {
    this.hide();
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  @HostListener('mouseenter')
  protected onMouseEnter(): void {
    this.scheduleShow();
  }

  @HostListener('mouseleave')
  protected onMouseLeave(): void {
    this.cancelShow();
    this.schedulePointerHide();
  }

  /** focusin burbujea: sirve en un envoltorio. El foco no espera, porque Tab es deliberado. */
  @HostListener('focusin')
  protected onFocusIn(): void {
    this.show();
  }

  @HostListener('focusout')
  protected onFocusOut(): void {
    this.hide();
  }

  private scheduleShow(): void {
    if (this.tooltipDisabled() || this.showTimer) {
      return;
    }
    this.cancelHide();
    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      this.show();
    }, TOOLTIP_SHOW_DELAY_MS);
  }

  private cancelShow(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  /** La gracia es tiempo de viaje hacia el panel, no una vida útil. */
  private schedulePointerHide(): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.pointerInsidePanel) {
        this.hide();
      }
    }, TOOLTIP_POINTER_GRACE_MS);
  }

  private cancelHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private show(): void {
    if (this.tooltipDisabled() || this.overlayRef?.hasAttached()) {
      return;
    }
    this.cancelShow();
    this.cancelHide();

    // Se reclama antes, para que el hide() del anterior no lo suelte.
    const previous = claimSingleton(this);
    if (previous && previous !== this) {
      previous.hide();
    }

    const overlayRef = (this.overlayRef ??= this.createOverlay());
    overlayRef.attach(new DomPortal(this.buildPanel()));

    if (this.describes()) {
      this.host.nativeElement.setAttribute('aria-describedby', this.panelId);
    }

    // En el documento: Escape anda aunque se abriera por hover con el foco en otro lado.
    this.document.addEventListener('keydown', this.onDocumentKeydown, true);
  }

  private hide(): void {
    this.cancelShow();
    this.cancelHide();
    this.pointerInsidePanel = false;

    this.document.removeEventListener('keydown', this.onDocumentKeydown, true);
    this.host.nativeElement.removeAttribute('aria-describedby');

    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.releasePanel();

    releaseSingleton(this);
  }

  /** Descarta sin mover puntero ni foco. */
  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hide();
    }
  };

  /** Estrategia compartida con el Select (overlay/connected-overlay.ts); cambian las posiciones. */
  private createOverlay(): OverlayRef {
    return createConnectedOverlay(
      this.injector,
      this.host.nativeElement,
      TOOLTIP_POSITIONS[this.position()],
    );
  }

  private buildPanel(): HTMLElement {
    // DomPortal exige que el nodo tenga padre; este sostén nunca entra al documento.
    const holder = this.document.createElement('div');
    const panel = this.document.createElement('div');
    holder.appendChild(panel);

    panel.id = this.panelId;
    panel.className = TOOLTIP_CLASSES;
    // Nunca innerHTML: un tooltip no lleva marcado.
    panel.textContent = this.text();

    if (this.describes()) {
      panel.setAttribute('role', 'tooltip');
    } else {
      panel.setAttribute('aria-hidden', 'true');
    }

    panel.addEventListener('mouseenter', this.onPanelMouseEnter);
    panel.addEventListener('mouseleave', this.onPanelMouseLeave);

    this.panel = panel;
    return panel;
  }

  private releasePanel(): void {
    if (!this.panel) {
      return;
    }
    this.panel.removeEventListener('mouseenter', this.onPanelMouseEnter);
    this.panel.removeEventListener('mouseleave', this.onPanelMouseLeave);
    this.panel.remove();
    this.panel = null;
  }

  private readonly onPanelMouseEnter = (): void => {
    this.pointerInsidePanel = true;
    this.cancelHide();
  };

  private readonly onPanelMouseLeave = (): void => {
    this.pointerInsidePanel = false;
    this.schedulePointerHide();
  };
}
