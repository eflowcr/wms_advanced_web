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

/**
 * El tooltip abierto, en toda la página: abrir uno cierra el anterior. El ámbito
 * de módulo es lo que lo hace cierto entre instancias que no se conocen.
 */
let openTooltip: Tooltip | null = null;

/** Registra `instance` como el abierto y devuelve quien tenía el lugar. */
function claimSingleton(instance: Tooltip): Tooltip | null {
  const previous = openTooltip;
  openTooltip = instance;
  return previous;
}

/** Suelta el lugar, pero solo si `instance` sigue siendo quien lo tiene. */
function releaseSingleton(instance: Tooltip): void {
  if (openTooltip === instance) {
    openTooltip = null;
  }
}

/**
 * Texto descriptivo corto al lado de un control, en hover y en foco de teclado.
 *
 * UN TOOLTIP NO ES UN NOMBRE ACCESIBLE: describe. Quien navega con teclado puede
 * no verlo nunca y en una pantalla táctil no hay hover, por eso
 * `ewms-icon-button` exige `label` además de `tooltip`.
 * WCAG 2.2 1.4.13 impone tres cosas, y las tres están: se descarta con Escape,
 * el puntero puede entrar al panel, y NUNCA cierra por temporizador.
 * El selector va prefijado: un `[tooltip]` pelado choca con cualquier cosa.
 */
@Directive({
  selector: '[ewmsTooltip]',
})
export class Tooltip implements OnDestroy {
  /** El texto, ya traducido por el consumidor (ADR 0008). */
  readonly text = input.required<string>({ alias: 'ewmsTooltip' });

  readonly position = input<TooltipPosition>('top');

  /**
   * Si el texto AGREGA información que el nombre accesible no da ya. `false` es el
   * caso del Icon Button, donde `label` y `tooltip` dicen lo mismo: atarlos con
   * `aria-describedby` haría que un lector lo anuncie dos veces, así que el panel
   * va `aria-hidden`. La directiva no adivina: lo declara el consumidor.
   */
  readonly describes = input<boolean>(false);

  /**
   * Apaga el tooltip sin quitar la directiva. NO se llama `disabled`, y el nombre
   * carga peso: una entrada así captura el `[disabled]` del propio host, el
   * atributo nativo nunca se escribe, y el control queda con cara de deshabilitado
   * y perfectamente clicable. Falla en silencio, en el peor atributo posible.
   */
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
    // Apagar la directiva en vuelo cierra lo que esté abierto, y un cambio de
    // texto con el panel abierto se refleja en vez de quedar viejo.
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

  // ---------------------------------------------------------------- gatillos

  @HostListener('mouseenter')
  protected onMouseEnter(): void {
    this.scheduleShow();
  }

  @HostListener('mouseleave')
  protected onMouseLeave(): void {
    this.cancelShow();
    this.schedulePointerHide();
  }

  /**
   * El par focusin/focusout, que burbujea, para que la directiva sirva también en
   * un envoltorio cuyo elemento enfocable es descendiente. El foco nunca espera:
   * navegar con Tab es deliberado, no se pasa de largo por un control.
   */
  @HostListener('focusin')
  protected onFocusIn(): void {
    this.show();
  }

  @HostListener('focusout')
  protected onFocusOut(): void {
    this.hide();
  }

  // ----------------------------------------------------------------- tiempos

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

  /**
   * Cierra cuando el puntero salió del control Y del panel. La gracia es tiempo de
   * viaje, no una vida: un tooltip donde el puntero descansa no cierra nunca.
   */
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

  // ------------------------------------------------------------ abrir y cerrar

  private show(): void {
    if (this.tooltipDisabled() || this.overlayRef?.hasAttached()) {
      return;
    }
    this.cancelShow();
    this.cancelHide();

    // Primero se reclama el lugar: así el hide() del tooltip anterior encuentra el
    // lugar ya tomado y lo deja en paz.
    const previous = claimSingleton(this);
    if (previous && previous !== this) {
      previous.hide();
    }

    const overlayRef = (this.overlayRef ??= this.createOverlay());
    overlayRef.attach(new DomPortal(this.buildPanel()));

    if (this.describes()) {
      this.host.nativeElement.setAttribute('aria-describedby', this.panelId);
    }

    // Escape tiene que andar aunque el tooltip se abriera por hover y el foco esté
    // en otro lado: el listener va en el documento, no en el host.
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

  /** Escape descarta sin mover puntero ni foco: nada acá llama a `focus()`. */
  private readonly onDocumentKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      this.hide();
    }
  };

  // ------------------------------------------------------------------- panel

  /**
   * Las posiciones son del tooltip; la estrategia se comparte con el panel del
   * Select (overlay/connected-overlay.ts). Solo cambia la lista de ubicaciones.
   */
  private createOverlay(): OverlayRef {
    return createConnectedOverlay(
      this.injector,
      this.host.nativeElement,
      TOOLTIP_POSITIONS[this.position()],
    );
  }

  private buildPanel(): HTMLElement {
    // Un DomPortal mueve un nodo que ya existe y deja un comentario donde estaba,
    // así que el nodo necesita padre. Este sostén es ese padre y nunca entra al
    // documento: existe para que el CDK tenga a quién devolver el panel.
    const holder = this.document.createElement('div');
    const panel = this.document.createElement('div');
    holder.appendChild(panel);

    panel.id = this.panelId;
    panel.className = TOOLTIP_CLASSES;
    // textContent y nunca innerHTML: un tooltip no puede llevar marcado.
    panel.textContent = this.text();

    if (this.describes()) {
      panel.setAttribute('role', 'tooltip');
    } else {
      // La etiqueta del control ya da el nombre; anunciar también el panel lo
      // diría dos veces.
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
