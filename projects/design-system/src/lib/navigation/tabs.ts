import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { Icon } from '../icon/icon';
import { Button } from '../button/button';
import type { Tab } from './navigation.types';

export type TabsMode = 'section' | 'document';

let nextTabsId = 0;

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

  protected readonly listId = `ewms-tabs-${++nextTabsId}`;

  private readonly overflowing = signal(false);

  protected readonly isDocument = computed(() => this.mode() === 'document');
  protected readonly showArrows = computed(() => this.isDocument() && this.overflowing());

  constructor() {
    // ResizeObserver: la tira se angosta al abrir el rail y ningún evento de ventana lo dice.
    afterNextRender(() => {
      const element = this.strip()?.nativeElement;
      if (element === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => {
        this.overflowing.set(element.scrollWidth > element.clientWidth + 1);
      });
      observer.observe(element);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
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

  private focusAndSelect(tab: Tab | undefined): void {
    if (tab === undefined) {
      return;
    }
    this.tabSelect.emit(tab);
    const selector = `[data-tab="${CSS.escape(tab.id)}"]`;
    this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
