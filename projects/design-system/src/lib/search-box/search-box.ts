import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  isDevMode,
  model,
  output,
  viewChild,
  type OnInit,
} from '@angular/core';
import { Button } from '../button/button';
import { FIELD_FONT_SIZES, FIELD_HEIGHT_CLASSES } from '../field/field.types';
import { Icon } from '../icon/icon';
import {
  EWMS_SEARCH_BOX_MESSAGES,
  NO_SEARCH_BOX_MESSAGES,
  normalizeQuery,
  searchButtonClasses,
  searchFieldClasses,
  type SearchBoxMessages,
} from './search-box.types';

export type { SearchBoxMessages } from './search-box.types';

let nextSearchBoxId = 0;

/**
 * Buscador en píldora, el de la cabecera (estructura de YouTube, pintura del sistema): campo con
 * etiqueta oculta, pista de tecla, limpiar y buscar pegado. No busca: dice qué buscar. Ver vault:
 * Componentes/Buscador.
 */
@Component({
  selector: 'ewms-search-box',
  templateUrl: './search-box.html',
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full max-w-(--search-max-width)' },
})
export class SearchBox implements OnInit {
  readonly value = model<string>('');

  /** Nombre del campo: oculto, pero un `<label for>` real. */
  readonly label = input.required<string>();

  readonly placeholder = input<string>('');

  /** Tecla que lleva el foco al campo, dibujada adentro y anunciada con `aria-keyshortcuts`. */
  readonly shortcut = input<string>('');

  readonly disabled = input<boolean>(false);

  /** Pisa, en esta instancia, los textos de `EWMS_SEARCH_BOX_MESSAGES` (ADR 0008). */
  readonly messages = input<Partial<SearchBoxMessages> | null>(null);

  /**
   * El texto, normalizado, al pulsar Enter o el botón; vacío no sale. No se llama `search`: es un
   * evento nativo (no-output-native), como `fieldFocus` en Input.
   */
  readonly searchSubmit = output<string>();

  protected readonly fieldId = `ewms-search-box-${++nextSearchBoxId}`;
  protected readonly heightClass = FIELD_HEIGHT_CLASSES.md;
  protected readonly fontSize = FIELD_FONT_SIZES.md;

  private readonly providedMessages = inject(EWMS_SEARCH_BOX_MESSAGES, { optional: true });
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  protected readonly words = computed<SearchBoxMessages>(() => ({
    ...(this.providedMessages ?? NO_SEARCH_BOX_MESSAGES),
    ...this.messages(),
  }));

  protected readonly fieldClasses = computed(() => searchFieldClasses(this.disabled()));
  protected readonly buttonClasses = computed(() => searchButtonClasses(this.disabled()));

  /** Con texto, la × ocupa el lugar de la pista: las dos juntas se leían como un campo roto. */
  protected readonly hasText = computed(() => this.value().length > 0);

  ngOnInit(): void {
    if (isDevMode() && (!this.words().submit || !this.words().clear)) {
      throw new Error(
        'ewms-search-box: its buttons need names; provide EWMS_SEARCH_BOX_MESSAGES or [messages].',
      );
    }
  }

  /** Para el atajo de la cabecera: el foco va al campo, no al componente. */
  focus(): void {
    this.field().nativeElement.focus();
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    const query = normalizeQuery(this.value());
    if (query) {
      this.searchSubmit.emit(query);
    }
  }

  protected clear(): void {
    this.value.set('');
    this.focus();
  }
}
