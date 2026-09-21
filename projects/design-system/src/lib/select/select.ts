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
 * Misma caja que `ewms-input` (field.types.ts). El foco nunca sale del gatillo: combobox APG
 * con `aria-activedescendant`, así «el foco vuelve al cerrar» se cumple sin `focus()`.
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
  /** Sin tope, como pide la ficha. */
  readonly options = input<readonly SelectOption[]>([]);

  readonly size = input<FieldSize>('md');

  /** Siembra el control; después manda `writeValue`. */
  readonly value = input<unknown>(null);

  readonly placeholder = input<string>('');

  /** Un `<button>` no es etiquetable: se une con `aria-labelledby`, no con for/id. */
  readonly label = input.required<string>();

  readonly hint = input<string>('');

  /** Solo visual: valida el formulario de arriba. */
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

  /** -1 es «en ningún lado». */
  protected readonly activeIndex = signal(-1);

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly panelClasses = SELECT_PANEL_CLASSES;
  protected readonly selectedWeight = SELECT_SELECTED_WEIGHT;
  protected readonly iconSize = FIELD_ICON_SIZE;

  /** Los del Input menos solo-lectura. */
  protected readonly effectiveState = computed<FieldState>(() => {
    if (this.isDisabled()) {
      return 'disabled';
    }
    return this.error() ? 'error' : 'default';
  });

  /** Abierto toma el borde de foco: el foco está en el gatillo. */
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

  /** Solo mientras existe el panel: un id fuera del documento es peor que ninguno. */
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

    // Ancho del gatillo leído al abrir, no guardado: cambia con el layout.
    overlayRef.updateSize({ width: this.trigger().nativeElement.getBoundingClientRect().width });
    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));

    // Siempre hay fila activa al abrir; si no, la flecha abajo pediría otra pulsación.
    this.activeIndex.set(Math.max(0, this.selectedIndex()));
    this.isOpen.set(true);
  }

  /** Se arma una vez: suscribirse en cada `open()` apilaría un listener por apertura. */
  private createOverlay(): OverlayRef {
    const overlayRef = createConnectedOverlay(
      this.injector,
      this.trigger().nativeElement,
      PANEL_POSITIONS,
    );
    // Por `close()` y no `detach`: una sola salida, así bandera, fila y overlay no discrepan.
    overlayRef.outsidePointerEvents().subscribe(() => this.close());
    return overlayRef;
  }

  /** Cierra sin tocar el valor; toda salida pasa por acá. */
  protected close(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

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
          // Si no, el clic del gatillo reabriría el panel.
          event.preventDefault();
          this.selectActive();
        }
        return;

      case 'Escape':
        if (this.isOpen()) {
          event.preventDefault();
          this.close();
        }
        return;

      case 'Tab':
        // Cierra sin elegir.
        this.close();
        return;

      default:
        return;
    }
  }

  /** La regla (frena en los extremos) vive en `listbox/`, compartida con search-select (HG-04). */
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

  /** El único camino que cambia el valor. */
  protected choose(option: SelectOption): void {
    this.commit(option.value);
    this.close();
    this.markTouched();
  }

  /** El foco se mueve en mousedown: prevenirlo lo deja en el gatillo. */
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
