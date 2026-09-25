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

/**
 * El activo en navy con texto claro, como en el menú lateral (decisión del usuario, 2026-09-25). Por
 * estado y no con variantes `aria-*`: utilidades que la hoja ya tenía.
 */
const ACTIVE_CLASSES = 'bg-brand-navy text-on-dark';

/** Cuatro destinos entran al ancho más angosto; el quinto lugar es «Más». */
export const BOTTOM_NAV_SLOTS = 4;

/**
 * Barra inferior (decisión del usuario, 2026-09-19): deja doce destinos a dos toques. La hoja
 * usa `FocusTrap` del CDK, no `DialogService`: es un panel, no un modal. Ver vault: Navegacion.
 */
@Component({
  selector: 'ewms-nav-bottom',
  templateUrl: './nav-bottom.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Escape en el host: la hoja es un contenedor no enfocable y lint rechaza un `(keydown)` ahí.
  host: { class: 'contents', '(keydown)': 'onSheetKeydown($event)' },
})
export class NavBottom {
  readonly items = input.required<readonly NavItem[]>();

  readonly label = input.required<string>();

  /** Título de la hoja y nombre del control «Más». */
  readonly moreLabel = input.required<string>();
  readonly closeLabel = input.required<string>();

  readonly activeId = input<string | null>(null);

  readonly itemSelect = output<NavItem>();

  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  private readonly focusTraps = inject(FocusTrapFactory);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private trap: FocusTrap | null = null;
  /** A quién devolver el foco: se recuerda, nunca se adivina. */
  private opener: HTMLElement | null = null;

  protected readonly open = signal(false);

  constructor() {
    // Una vez acá: registrarlo en cada apertura suma callbacks y mantiene vivas las trampas.
    this.destroyRef.onDestroy(() => this.trap?.destroy());
  }

  // Un grupo de primer nivel nunca va a la barra: sería «Más» con otro nombre.
  protected readonly barItems = computed(() =>
    this.items()
      .filter((item) => !isGroup(item))
      .slice(0, BOTTOM_NAV_SLOTS),
  );

  protected readonly hasMore = computed(
    () => this.barItems().length < this.items().length || this.items().some(isGroup),
  );

  protected barClasses(item: NavItem): string {
    return this.activeId() === item.id ? ACTIVE_CLASSES : 'hover:bg-ghost-hover';
  }

  protected sheetClasses(item: NavItem): string {
    return this.activeId() === item.id
      ? `${ACTIVE_CLASSES} text-h4`
      : 'text-p hover:bg-ghost-hover';
  }

  protected isGroup(item: NavItem): boolean {
    return isGroup(item);
  }

  protected onBarSelect(item: NavItem): void {
    this.itemSelect.emit(item);
  }

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

    // `afterNextRender` y no un microtask: con zoneless la hoja aún no existe y la trampa
    // no se armaba (el foco quedaba en «Más»). Encontrado a 375 px.
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

  /** Escape, cierre o fondo: un solo camino. */
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
