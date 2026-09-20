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
 * Single-choice selector with a floating panel.
 *
 * The closed trigger is the same box as `ewms-input` -- same heights, padding,
 * type scale, radius and border colours, all from field.types.ts. That is a
 * rule and not a coincidence: a select is almost always in a row with an input
 * and a button, and the three have to line up.
 *
 * THE FOCUS NEVER LEAVES THE TRIGGER. The panel is not focusable and nothing
 * inside it is; the arrow keys move an ACTIVE row and `aria-activedescendant`
 * tells assistive technology which one it is. This is the ARIA Authoring
 * Practices pattern for a select-only combobox, and it makes "the focus
 * returns to the trigger when the panel closes" true by construction rather
 * than by a `focus()` call that has to fire on every one of the four ways out
 * (Enter, Escape, a click on an option, a click outside).
 *
 * `aria-controls` is present ONLY while the panel exists. Pointing it at an
 * id that is not in the document is an invalid attribute value, and an invalid
 * one is worse than an absent one.
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
  /**
   * The rows, in the order they are shown. No limit is imposed here and none
   * is hard-coded in the template: the ficha is explicit about that.
   */
  readonly options = input<readonly SelectOption[]>([]);

  readonly size = input<FieldSize>('md');

  /** The chosen value. Seeds the control; `writeValue` takes over after that. */
  readonly value = input<unknown>(null);

  /** Shown when nothing is chosen. Already translated. */
  readonly placeholder = input<string>('');

  /**
   * Required and rendered as visible text, for the same reason as the Input's:
   * a control with no name is a control nobody can ask for. A `<button>` is
   * not a labelable element, so the two are joined with `aria-labelledby`
   * rather than for/id.
   */
  readonly label = input.required<string>();

  /** Help text under the trigger. Turns danger-coloured when `error`. */
  readonly hint = input<string>('');

  /**
   * Purely visual, like the Input's `state="error"`. This component validates
   * nothing; the parent form decides.
   */
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

  /**
   * Where the keyboard is, as an index into `options`. `-1` is "nowhere",
   * which is what a panel opened with no current value starts at.
   */
  protected readonly activeIndex = signal(-1);

  protected readonly baseClasses = FIELD_BASE_CLASSES;
  protected readonly panelClasses = SELECT_PANEL_CLASSES;
  protected readonly selectedWeight = SELECT_SELECTED_WEIGHT;
  protected readonly iconSize = FIELD_ICON_SIZE;

  /**
   * Error, disabled or neither -- the Input's three shared states, minus
   * read-only, which a select has no meaning for.
   */
  protected readonly effectiveState = computed<FieldState>(() => {
    if (this.isDisabled()) {
      return 'disabled';
    }
    return this.error() ? 'error' : 'default';
  });

  /**
   * Open gets the same border as Focus -- which costs nothing, because the
   * focus is on the trigger the whole time the panel is up.
   */
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

  /** The chosen row's text, or the placeholder while there is none. */
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

  /** Only while the panel exists: an id that is not in the document is invalid. */
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

  // ------------------------------------------------------------- open/close

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

    // The panel is as wide as the trigger. Read at open time rather than
    // stored, because the trigger's width changes with the layout around it.
    overlayRef.updateSize({ width: this.trigger().nativeElement.getBoundingClientRect().width });
    overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));

    // Opening always leaves a row active: the chosen one when there is one,
    // the first otherwise. A panel opened with the down arrow and no active row
    // would need a second press before anything moved, and a keyboard user
    // would have nothing for `aria-activedescendant` to point at meanwhile.
    this.activeIndex.set(Math.max(0, this.selectedIndex()));
    this.isOpen.set(true);
  }

  /**
   * The overlay is built once and reused. The outside-click subscription lives
   * here rather than in `open()` for that reason: subscribing on every open
   * would stack one more listener each time the panel is raised, and by the
   * tenth open a single click outside would call `close()` ten times.
   */
  private createOverlay(): OverlayRef {
    const overlayRef = createConnectedOverlay(
      this.injector,
      this.trigger().nativeElement,
      PANEL_POSITIONS,
    );
    // A click anywhere else closes, and leaves the value alone. `detach` is
    // not called directly: close() is the single exit, so the open flag, the
    // active row and the overlay can never disagree.
    overlayRef.outsidePointerEvents().subscribe(() => this.close());
    return overlayRef;
  }

  /**
   * Close, WITHOUT touching the value. Every exit goes through here: Escape, a
   * chosen option, a click outside, destruction.
   */
  protected close(): void {
    if (this.overlayRef?.hasAttached()) {
      this.overlayRef.detach();
    }
    this.isOpen.set(false);
    this.activeIndex.set(-1);
  }

  // ---------------------------------------------------------------- keyboard

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
          // Stop the trigger's own click from firing and reopening what this
          // is about to close.
          event.preventDefault();
          this.selectActive();
        }
        return;

      case 'Escape':
        if (this.isOpen()) {
          // Dismissal, and NOTHING ELSE. The value the panel was showing stays
          // exactly as it was; `close()` is the only thing called, and it does
          // not go near `commit`.
          event.preventDefault();
          this.close();
        }
        return;

      case 'Tab':
        // Leaving the control closes the panel, but does not choose anything:
        // the focus is on its way somewhere else.
        this.close();
        return;

      default:
        return;
    }
  }

  /**
   * Move the active row. The rule -- stop at the ends, do not wrap -- lives in
   * `listbox/`, shared with `ewms-search-select`: REQ-FE-DS3-001 HG-04 forbids
   * a second keyboard implementation beside this one, and "does the list wrap"
   * is exactly the kind of thing two copies would answer differently.
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

  // ----------------------------------------------------------------- choose

  /**
   * Commit a value and close. The only path in this component that changes the
   * value -- Escape, Tab and an outside click all end at `close()` instead.
   */
  protected choose(option: SelectOption): void {
    this.commit(option.value);
    this.close();
    this.markTouched();
  }

  /**
   * A press on an option must not take the focus off the trigger, and the
   * focus moves on mousedown, before the click ever happens. Preventing the
   * default here is what keeps `aria-activedescendant` meaningful and what
   * makes "the focus is back on the trigger after closing" true without a
   * single `focus()` call.
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
