import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Icon } from '../icon/icon';
import { Button } from '../button/button';
import type { Tab } from './navigation.types';

export type TabsMode = 'section' | 'document';

let nextTabsId = 0;

/**
 * Documento: chip en píldora como la barra de YouTube (decisión del usuario, 2026-09-25). Activo en
 * navy con texto claro; el resto en gris y un tono más oscuro en hover.
 */
const CHIP_CLASSES = 'h-(--chip-height) rounded-full px-3';
const CHIP_ACTIVE_CLASSES = 'bg-brand-navy text-h4 text-on-dark';
const CHIP_REST_CLASSES = 'bg-chip text-p text-primary hover:bg-chip-hover';

/** Sección: pestañas de un canal de YouTube, con el subrayado navy bajo la activa. */
const SECTION_CLASSES = 'relative rounded-sm px-3 py-2';
const SECTION_ACTIVE_CLASSES = 'text-h4 text-primary';
const SECTION_REST_CLASSES = 'text-p text-secondary hover:text-primary';

/**
 * Dos modos (`section`, `document` MDI), un componente: un solo teclado y contrato de foco.
 * No pinta `tabpanel`: en el shell es el `<router-outlet>`. Ver vault: Navegacion.
 */
@Component({
  selector: 'ewms-tabs',
  templateUrl: './tabs.html',
  imports: [Icon, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0' },
})
export class Tabs {
  readonly tabs = input.required<readonly Tab[]>();
  readonly activeId = input<string | null>(null);
  readonly mode = input<TabsMode>('section');

  /** Obligatorio: tabs de sección dentro de una pestaña de documento son dos tablists. */
  readonly label = input.required<string>();

  readonly scrollBackLabel = input<string>('');
  readonly scrollForwardLabel = input<string>('');

  readonly tabSelect = output<Tab>();
  readonly tabClose = output<Tab>();

  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  protected readonly listId = `ewms-tabs-${++nextTabsId}`;

  private readonly overflowing = signal(false);
  private readonly atStart = signal(true);
  private readonly atEnd = signal(true);

  protected readonly isDocument = computed(() => this.mode() === 'document');

  /** Una flecha por lado, y solo si hay algo escondido de ese lado (como en YouTube). */
  protected readonly showBack = computed(
    () => this.isDocument() && this.overflowing() && !this.atStart(),
  );
  protected readonly showForward = computed(
    () => this.isDocument() && this.overflowing() && !this.atEnd(),
  );

  constructor() {
    // ResizeObserver: la tira se angosta al abrir el rail y ningún evento de ventana lo dice.
    afterNextRender(() => {
      const element = this.strip()?.nativeElement;
      if (element === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // La activa siempre a la vista: a 375 px la cuarta pestaña abierta quedaba fuera de la tira.
    effect(() => {
      const active = this.activeId();
      this.tabs();
      untracked(() => afterNextRender(() => this.reveal(active), { injector: this.injector }));
    });
  }

  protected tabClasses(tab: Tab): string {
    const active = this.activeId() === tab.id;
    if (this.isDocument()) {
      return `${CHIP_CLASSES} ${active ? CHIP_ACTIVE_CLASSES : CHIP_REST_CLASSES}`;
    }
    return `${SECTION_CLASSES} ${active ? SECTION_ACTIVE_CLASSES : SECTION_REST_CLASSES}`;
  }

  /** La × oscurece su círculo sobre el chip que tenga debajo. */
  protected closeClasses(tab: Tab): string {
    return this.activeId() === tab.id
      ? 'hover:bg-chip-active-close-hover'
      : 'hover:bg-chip-close-hover';
  }

  /** Desborde y bordes alcanzados; lo llaman el observador y el desplazamiento de la tira. */
  protected measure(): void {
    const element = this.strip()?.nativeElement;
    if (element === undefined) {
      return;
    }
    const arrow = this.document.activeElement?.closest('[data-tabs-back], [data-tabs-forward]');
    this.overflowing.set(element.scrollWidth > element.clientWidth + 1);
    this.atStart.set(element.scrollLeft <= 1);
    this.atEnd.set(element.scrollLeft + element.clientWidth >= element.scrollWidth - 1);

    // La flecha con el foco se va al llegar al borde: el foco pasa a la activa y no cae al body.
    const gone = arrow?.hasAttribute('data-tabs-back') ? !this.showBack() : !this.showForward();
    if (arrow !== null && arrow !== undefined && gone) {
      const id = this.activeId();
      if (id !== null) {
        element.querySelector<HTMLElement>(`[data-tab="${CSS.escape(id)}"]`)?.focus();
      }
    }
  }

  protected isClosable(tab: Tab): boolean {
    // En MDI la que no se cierra es la excepción.
    return this.isDocument() && tab.closable !== false;
  }

  protected onSelect(tab: Tab): void {
    if (tab.disabled === true) {
      return;
    }
    this.tabSelect.emit(tab);
  }

  // El glifo está dentro del botón de la pestaña: sin `stopPropagation`, cerrar la seleccionaría.
  protected onCloseGlyph(event: Event, tab: Tab): void {
    event.stopPropagation();
    this.tabClose.emit(tab);
  }

  // Teclado de tabs de las APG. `Delete` solo cierra en modo `document` y si es cerrable.
  protected onKeydown(event: KeyboardEvent, tab: Tab): void {
    const tabs = this.tabs().filter((candidate) => candidate.disabled !== true);
    const index = tabs.findIndex((candidate) => candidate.id === tab.id);

    switch (event.key) {
      case 'ArrowRight':
        this.focusAndSelect(tabs[(index + 1) % tabs.length]);
        break;
      case 'ArrowLeft':
        this.focusAndSelect(tabs[(index - 1 + tabs.length) % tabs.length]);
        break;
      case 'Home':
        this.focusAndSelect(tabs[0]);
        break;
      case 'End':
        this.focusAndSelect(tabs[tabs.length - 1]);
        break;
      case 'Delete':
        if (this.isClosable(tab)) {
          this.tabClose.emit(tab);
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected scrollBy(direction: -1 | 1): void {
    const element = this.strip()?.nativeElement;
    if (element === undefined) {
      return;
    }
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: 'smooth' });
  }

  /** Solo si no se ve entera: centrarla siempre movería la tira a cada clic. */
  private reveal(id: string | null): void {
    const strip = this.strip()?.nativeElement;
    if (id === null || strip === undefined) {
      return;
    }
    const tab = strip.querySelector<HTMLElement>(`[data-tab="${CSS.escape(id)}"]`);
    if (tab === null || typeof tab.scrollIntoView !== 'function') {
      return;
    }
    const box = tab.getBoundingClientRect();
    const view = strip.getBoundingClientRect();
    if (box.left < view.left || box.right > view.right) {
      tab.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }

  private focusAndSelect(tab: Tab | undefined): void {
    if (tab === undefined) {
      return;
    }
    this.tabSelect.emit(tab);
    const selector = `[data-tab="${CSS.escape(tab.id)}"]`;
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
