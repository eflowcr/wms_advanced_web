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
import { IconButton } from '../icon-button/icon-button';
import type { Tab } from './navigation.types';

export type TabsMode = 'section' | 'document';

let nextTabsId = 0;

/**
 * DOS MODOS, UN COMPONENTE: `section` es una tira subrayada para las subsecciones
 * de una pantalla, `document` es la tira MDI del App Shell. No se parecen y SON el
 * mismo control -una lista de cosas, una de ellas mostrándose-; dos componentes
 * serían dos teclados y dos contratos de foco que mantener al día.
 * ACÁ NO SE PINTA NINGÚN `tabpanel`: en el shell el panel es el `<router-outlet>`.
 * El teclado es el de las APG y la activación sigue al foco.
 */
@Component({
  selector: 'ewms-tabs',
  templateUrl: './tabs.html',
  imports: [Icon, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0' },
})
export class Tabs {
  readonly tabs = input.required<readonly Tab[]>();
  readonly activeId = input<string | null>(null);
  readonly mode = input<TabsMode>('section');

  /**
   * El nombre de la tira, ya traducido. Obligatorio como el del rail: una pantalla
   * con tabs de sección dentro de una pestaña de documento tiene dos tablists.
   */
  readonly label = input.required<string>();

  /** Etiquetas de los controles de desborde, ya traducidas. */
  readonly scrollBackLabel = input<string>('');
  readonly scrollForwardLabel = input<string>('');

  readonly tabSelect = output<Tab>();
  readonly tabClose = output<Tab>();

  private readonly strip = viewChild<ElementRef<HTMLElement>>('strip');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly listId = `ewms-tabs-${++nextTabsId}`;

  /** Si la tira es más ancha que su caja, para que las flechas tengan trabajo. */
  private readonly overflowing = signal(false);

  protected readonly isDocument = computed(() => this.mode() === 'document');
  protected readonly showArrows = computed(() => this.isDocument() && this.overflowing());

  constructor() {
    /*
     * Un ResizeObserver y no un listener de resize de ventana: la tira se angosta
     * cuando el rail se abre, y eso ningún evento de ventana lo reporta.
     */
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
    // Cerrable salvo que diga lo contrario: en una tira MDI la que no se cierra es
    // la excepción, y la excepción es lo que se escribe.
    return this.isDocument() && tab.closable !== false;
  }

  protected onSelect(tab: Tab): void {
    if (tab.disabled === true) {
      return;
    }
    this.tabSelect.emit(tab);
  }

  /**
   * El cierre con el ratón, desde el glifo de adentro. `stopPropagation` porque el
   * glifo está dentro del botón de la pestaña: sin él, cerrarla la seleccionaría.
   */
  protected onCloseGlyph(event: Event, tab: Tab): void {
    event.stopPropagation();
    this.tabClose.emit(tab);
  }

  /**
   * El teclado de tabs de las APG. `Delete` cierra la pestaña donde estás: es la
   * única tecla destructiva y va con doble guarda -tiene que ser cerrable, y solo
   * lo es en modo `document`-.
   */
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
