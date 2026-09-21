import { FocusTrapFactory, type FocusTrap } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Icon } from '../icon/icon';
import { isGroup, type NavItem } from './navigation.types';

/** Cuántos destinos entran abajo en un teléfono antes de que las etiquetas dejen
 * de leerse: cuatro al ancho más angosto. El quinto lugar es el control «Más». */
export const BOTTOM_NAV_SLOTS = 4;

/**
 * La navegación en pantalla angosta: una barra inferior. DECISIÓN DEL USUARIO
 * (2026-09-19): el frente proponía un drawer y el usuario eligió la barra.
 *
 * EL COSTO, escrito y no escondido: una barra lleva tres a cinco destinos de
 * primer nivel, y este menú tiene cuatro en el primero y DOCE en el segundo. Esos
 * doce quedan a DOS TOQUES, uno más que en el rail, en el dispositivo donde un
 * toque cuesta más.
 * La hoja usa el `FocusTrap` del CDK y NO `DialogService`: es un panel pegado a la
 * barra, no un modal, y abrirla como diálogo le daría `role="dialog"` y haría de
 * la navegación de la aplicación un diálogo.
 */
@Component({
  selector: 'ewms-nav-bottom',
  templateUrl: './nav-bottom.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*
   * ESCAPE SE ATIENDE EN EL HOST Y NO EN LA HOJA: un `(keydown)` sobre el `<div>`
   * de la hoja es un manejador en algo que no es enfocable, que la regla de lint
   * rechaza con razón. La hoja es un CONTENEDOR -lo enfocado es lo que tiene
   * adentro-, así que el listener va un nivel arriba, adonde el evento burbujea.
   */
  host: { class: 'contents', '(keydown)': 'onSheetKeydown($event)' },
})
export class NavBottom {
  readonly items = input.required<readonly NavItem[]>();

  /** El nombre del landmark, ya traducido. */
  readonly label = input.required<string>();

  /** El título de la hoja y el nombre del control «Más», ya traducidos. */
  readonly moreLabel = input.required<string>();
  readonly closeLabel = input.required<string>();

  readonly activeId = input<string | null>(null);

  readonly itemSelect = output<NavItem>();

  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  private readonly focusTraps = inject(FocusTrapFactory);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private trap: FocusTrap | null = null;
  /** A quién devolverle el foco. Nunca se adivina: se recuerda. */
  private opener: HTMLElement | null = null;

  protected readonly open = signal(false);

  constructor() {
    // UNA VEZ acá y no en cada apertura: registrar el desarme dentro del manejador
    // de clic suma un callback por apertura y mantiene viva cada trampa.
    this.destroyRef.onDestroy(() => this.trap?.destroy());
  }

  /**
   * Qué muestra la barra y qué guarda la hoja. Un GRUPO de primer nivel nunca va a
   * la barra: tocarlo tendría que abrir algo igual, o sea «Más» con otro nombre.
   */
  protected readonly barItems = computed(() =>
    this.items()
      .filter((item) => !isGroup(item))
      .slice(0, BOTTOM_NAV_SLOTS),
  );

  /** Si sobra algo para la hoja. */
  protected readonly hasMore = computed(
    () => this.barItems().length < this.items().length || this.items().some(isGroup),
  );

  protected isGroup(item: NavItem): boolean {
    return isGroup(item);
  }

  protected onBarSelect(item: NavItem): void {
    this.itemSelect.emit(item);
  }

  /** Desde la hoja: elegir un destino y cerrar detrás. */
  protected onSheetSelect(item: NavItem): void {
    if (isGroup(item)) {
      return;
    }
    this.itemSelect.emit(item);
    this.close();
  }

  protected onOpen(event: Event): void {
    this.opener = event.currentTarget as HTMLElement;
    this.open.set(true);

    /*
     * `afterNextRender` Y NO `queueMicrotask`, y la diferencia es toda la función:
     * cuando se atiende este clic, `@if (open())` todavía no dibujó la hoja, así
     * que la trampa nunca se construía. Un microtask tampoco alcanza -Angular
     * zoneless pinta a su propio ritmo-, y la primera versión no hacía nada en
     * silencio: el foco se quedaba en «Más». Encontrado abriéndola a 375 px.
     */
    afterNextRender(
      () => {
        const element = this.sheet()?.nativeElement;
        if (element === undefined) {
          return;
        }
        this.trap = this.focusTraps.create(element);
        void this.trap.focusFirstTabbableElementWhenReady();
      },
      { injector: this.injector },
    );
  }

  /** Escape, el control de cierre o el fondo. Los tres, un solo camino. */
  protected close(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.trap?.destroy();
    this.trap = null;
    this.opener?.focus();
    this.opener = null;
  }

  protected onSheetKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }
}
