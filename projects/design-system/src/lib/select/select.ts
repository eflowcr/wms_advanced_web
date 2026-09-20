import type { OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import {
  FIELD_BASE_CLASSES,
  FIELD_FONT_SIZES,
  FIELD_HEIGHT_CLASSES,
  FIELD_ICON_SIZE,
  FIELD_PADDING_CLASSES,
  fieldBorderColor,
  fieldSurfaceClasses,
  type FieldSize,
  type FieldState,
} from '../field/field.types';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { Icon } from '../icon/icon';
import { moveActiveIndex } from '../listbox/listbox.types';
import { createConnectedOverlay, PANEL_POSITIONS } from '../overlay/connected-overlay';
import {
  SELECT_PANEL_CLASSES,
  SELECT_SELECTED_WEIGHT,
  selectOptionClasses,
  type SelectOption,
} from './select.types';

export type { SelectOption } from './select.types';

let nextSelectId = 0;

/**
 * Selector de una opción con panel flotante. El gatillo cerrado es la misma caja
 * que `ewms-input`, por field.types.ts, porque casi siempre van en la misma fila.
 * EL FOCO NUNCA SALE DEL GATILLO: el panel no es enfocable y las flechas mueven
 * una fila activa con `aria-activedescendant` (patrón combobox de las APG), así
 * «el foco vuelve al cerrar» es cierto por construcción y no por un `focus()`.
 * `aria-controls` solo existe mientras existe el panel: un id que no está en el
 * documento es un valor inválido, y eso es peor que ausente.
 */
@Component({
  selector: 'ewms-select',
  templateUrl: './select.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  providers: [provideValueAccessor(() => Select)],
})
export class Select extends FormControlBase<unknown> implements OnDestroy {
  /** Las filas, en orden. Sin tope acá ni en la plantilla: la ficha es explícita. */
  readonly options = input<readonly SelectOption[]>([]);

  readonly size = input<FieldSize>('md');

  /** El valor elegido. Siembra el control; después manda `writeValue`. */
  readonly value = input<unknown>(null);

  /** Se ve cuando no hay nada elegido. Ya traducido. */
  readonly placeholder = input<string>('');

  /**
   * Obligatoria y visible, como la del Input. Un `<button>` no es etiquetable,
   * así que se unen con `aria-labelledby` y no con for/id.
   */
  readonly label = input.required<string>();

  /** Texto de ayuda bajo el gatillo. Se pinta de peligro con `error`. */
  readonly hint = input<string>('');

  /** Solo visual. Este componente no valida; decide el formulario de arriba. */
  readonly error = input<boolean>(false);

  private readonly injector = inject(Injector);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef: OverlayRef | null = null;

  private readonly id = ++nextSelectId;
  protected readonly triggerId = `ewms-select-${this.id}`;
  protected readonly labelId = `${this.triggerId}-label`;
  protected readonly listboxId = `${this.triggerId}-listbox`;
  protected readonly hintId = `${this.triggerId}-hint`;

  protected readonly valueSource = this.value;

  protected readonly isOpen = signal(false);

  /** Dónde está el teclado, como índice. `-1` es «en ningún lado». */
  protected readonly activeIndex = signal(-1);

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly panelClasses = SELECT_PANEL_CLASSES;
  protected readonly selectedWeight = SELECT_SELECTED_WEIGHT;
  protected readonly iconSize = FIELD_ICON_SIZE;

  /** Error, deshabilitado o ninguno: los del Input menos solo-lectura. */
  protected readonly effectiveState = computed<FieldState>(() => {
    if (this.isDisabled()) {
      return 'disabled';
    }
    return this.error() ? 'error' : 'default';
  });

  /** Abierto toma el borde de Foco, que no cuesta nada: el foco está en el gatillo. */
  protected readonly borderColor = computed(() =>
    fieldBorderColor(this.effectiveState(), this.isOpen()),
  );

  protected readonly triggerClasses = computed(() =>
    [
      this.baseClasses,
      'flex items-center justify-between gap-2 text-left',
      FIELD_HEIGHT_CLASSES[this.size()],
      FIELD_PADDING_CLASSES[this.size()],
      fieldSurfaceClasses(this.effectiveState()),
      this.isDisabled() ? '' : 'cursor-pointer',
    ]
      .join(' ')
      .trim(),
  );

  protected readonly fontSize = computed(() => FIELD_FONT_SIZES[this.size()]);

  protected readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => option.value === this.controlValue()),
  );

  protected readonly selectedOption = computed(() => this.options()[this.selectedIndex()] ?? null);

  /** El texto de la fila elegida, o el placeholder mientras no hay ninguna. */
  protected readonly triggerText = computed(
    () => this.selectedOption()?.label ?? this.placeholder(),
  );

  protected readonly triggerTextClasses = computed(() =>
    this.selectedOption() ? '' : 'text-secondary',
  );

  protected readonly describedBy = computed(() => (this.hint() ? this.hintId : null));

  protected readonly hintClasses = computed(() =>
    this.effectiveState() === 'error' ? 'text-danger' : 'text-secondary',
  );

  /** Solo mientras existe el panel: un id fuera del documento es inválido. */
  protected readonly controlsId = computed(() => (this.isOpen() ? this.listboxId : null));

  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.isOpen() && index >= 0 ? this.optionId(index) : null;
  });

  protected optionId(index: number): string {
    return `${this.triggerId}-option-${index}`;
  }

  protected optionClasses(index: number): string {
    return selectOptionClasses(index === this.selectedIndex(), index === this.activeIndex());
  }

  ngOnDestroy(): void {
    this.close();
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  // ----------------------------------------------------------- abrir y cerrar

  protected toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  protected open(): void {
    if (this.isDisabled() || this.isOpen()) {
      return;
    }

    const overlayRef = (this.overlayRef ??= this.createOverlay());

    // El panel es tan ancho como el gatillo, leído al abrir y no guardado: el
    // ancho del gatillo cambia con el layout de alrededor.
    overlayRef.updateSize({ width: this.trigger().nativeElement.getBoundingClientRect().width });
    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));

    // Abrir siempre deja una fila activa: la elegida, o la primera. Sin eso, un
    // panel abierto con la flecha abajo necesitaría una segunda pulsación y
    // `aria-activedescendant` no tendría a qué apuntar mientras tanto.
    this.activeIndex.set(Math.max(0, this.selectedIndex()));
    this.isOpen.set(true);
  }

  /**
   * El overlay se arma una vez y se reusa, y por eso la suscripción al clic de
   * afuera vive acá: suscribirse en cada `open()` apilaría un listener más por
   * apertura, y al décimo un clic afuera llamaría a `close()` diez veces.
   */
  private createOverlay(): OverlayRef {
    const overlayRef = createConnectedOverlay(
      this.injector,
      this.trigger().nativeElement,
      PANEL_POSITIONS,
    );
    // Un clic en cualquier otro lado cierra y deja el valor. No se llama a
    // `detach` directo: `close()` es la única salida, así la bandera, la fila
    // activa y el overlay no pueden discrepar.
    overlayRef.outsidePointerEvents().subscribe(() => this.close());
    return overlayRef;
  }

  /** Cierra SIN tocar el valor. Toda salida pasa por acá. */
  protected close(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  // ------------------------------------------------------------------ teclado

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (this.isOpen()) {
          this.moveActive(1);
        } else {
          this.open();
        }
        return;

      case 'ArrowUp':
        event.preventDefault();
        if (this.isOpen()) {
          this.moveActive(-1);
        } else {
          this.open();
        }
        return;

      case 'Enter':
        if (this.isOpen()) {
          // Frena el clic del propio gatillo, que reabriría lo que esto cierra.
          event.preventDefault();
          this.selectActive();
        }
        return;

      case 'Escape':
        if (this.isOpen()) {
          // Solo descarta: el valor que mostraba el panel queda igual, y `close()`
          // no se acerca a `commit`.
          event.preventDefault();
          this.close();
        }
        return;

      case 'Tab':
        // Salir del control cierra el panel pero no elige nada.
        this.close();
        return;

      default:
        return;
    }
  }

  /**
   * Mueve la fila activa. La regla -frena en los extremos, no da la vuelta- vive
   * en `listbox/`, compartida con `ewms-search-select`: HG-04 prohíbe un segundo
   * teclado, y «¿da la vuelta?» es justo lo que dos copias responderían distinto.
   */
  private moveActive(delta: number): void {
    const count = this.options().length;
    if (count === 0) {
      return;
    }
    this.activeIndex.set(moveActiveIndex(this.activeIndex(), delta, count));
  }

  private selectActive(): void {
    const option = this.options()[this.activeIndex()];
    if (option) {
      this.choose(option);
    }
  }

  // ------------------------------------------------------------------- elegir

  /** Confirma un valor y cierra. El único camino que lo cambia. */
  protected choose(option: SelectOption): void {
    this.commit(option.value);
    this.close();
    this.markTouched();
  }

  /**
   * Pulsar una opción no puede sacar el foco del gatillo, y el foco se mueve en
   * mousedown, antes del clic. Prevenirlo acá es lo que hace significativo a
   * `aria-activedescendant` sin una sola llamada a `focus()`.
   */
  protected onOptionMousedown(event: MouseEvent): void {
    event.preventDefault();
  }

  protected onOptionEnter(index: number): void {
    this.activeIndex.set(index);
  }

  protected onTriggerBlur(): void {
    this.markTouched();
  }
}
