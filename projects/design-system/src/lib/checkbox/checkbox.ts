import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormControlBase, provideValueAccessor } from '../forms/control-value-accessor';
import { Icon } from '../icon/icon';
import {
  SELECTION_BORDER_WIDTH,
  SELECTION_CONTROL_BASE_CLASSES,
  SELECTION_GLYPH_CLASSES,
  SELECTION_ROW_CLASSES,
  selectionBoxClasses,
  selectionRowStateClasses,
} from '../selection/selection.types';

/**
 * Una casilla: 18x18 con un tilde, un guion o nada.
 *
 * NO ES UN TOGGLE, y la diferencia no es cómo se ve: una casilla es una SELECCIÓN
 * DENTRO DE UN FORMULARIO que algo confirma después; un toggle APLICA AL TOCARLO.
 * Elegir mal pone un botón Guardar al lado de algo ya guardado.
 * Se conserva el `<input type="checkbox">` nativo con `appearance-none` en vez de
 * esconderlo tras un span pintado: así el rol, la barra espaciadora, el orden de
 * tabulación, el anillo de foco y el nombre del `<label>` salen gratis.
 */
@Component({
  selector: 'ewms-checkbox',
  templateUrl: './checkbox.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  providers: [provideValueAccessor(() => Checkbox)],
})
export class Checkbox extends FormControlBase<boolean> {
  readonly checked = input<boolean>(false);

  /**
   * Ni sí ni no: la casilla de «seleccionar todo» sobre una lista a medias. Gana
   * sobre `checked` al verse y al anunciarse, porque es la afirmación más
   * específica.
   */
  readonly indeterminate = input<boolean>(false);

  /**
   * El texto visible al lado, ya traducido. Opcional, porque la cabecera de una
   * tabla seleccionable no lo lleva y entonces el nombre lo pone `ariaLabel`. UNA
   * DE LAS DOS es obligatoria en la práctica: sin ninguna no hay nombre accesible
   * y falla axe. El tipo no sabe decir «exactamente una», así que lo afirma el spec.
   */
  readonly label = input<string>('');

  /** El nombre accesible cuando no hay texto visible: una columna de casillas de
   * fila, donde el nombre tiene que decir CUÁL fila. Ya traducido. */
  readonly ariaLabel = input<string>('');

  /**
   * NO se llama `change`, y el nombre carga peso: `change` es un evento nativo y
   * burbujea, así que una salida con ese nombre pone dos cosas en un mismo enlace
   * -el booleano de este componente Y el Event crudo que sube del `<input>`- y el
   * handler corre dos veces con dos tipos de argumento. ESLint no-output-native lo
   * prohíbe. Desviación de la ficha, reportada.
   */
  readonly checkedChange = output<boolean>();

  /** La base se siembra del propio valor del componente. */
  protected readonly valueSource = this.checked;

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected readonly rowClasses = computed(
    () => `${SELECTION_ROW_CLASSES} ${selectionRowStateClasses(this.isDisabled())}`,
  );

  protected readonly borderWidth = SELECTION_BORDER_WIDTH;

  /** Marcado e indeterminado comparten el relleno; solo cambia el glifo. */
  protected readonly isOn = computed(() => this.indeterminate() || this.controlValue());

  protected readonly boxClasses = computed(
    () =>
      // rounded-sm son 4 px: la esquina de la casilla, lo único de la caja que el
      // radio no comparte.
      `${SELECTION_CONTROL_BASE_CLASSES} rounded-sm ` +
      selectionBoxClasses(this.isOn(), this.isDisabled()),
  );

  protected readonly glyphClasses = SELECTION_GLYPH_CLASSES;

  /**
   * `mixed`, ni `true` ni `false`: entre marcado e indeterminado solo cambia un
   * glifo dentro de una caja idéntica, así que quien no la ve saca el estado de
   * acá y de ningún otro lado.
   */
  protected readonly ariaChecked = computed(() => {
    if (this.indeterminate()) {
      return 'mixed';
    }
    return this.controlValue() ? 'true' : 'false';
  });

  constructor() {
    super();

    /**
     * `indeterminate` EXISTE SOLO COMO PROPIEDAD DEL DOM: no hay atributo HTML,
     * así que escribirlo en una plantilla pone un atributo desconocido, la caja
     * se pinta sin marcar y nada reporta nada. Hay que asignarlo al elemento.
     * Un effect y no un ngAfterViewInit porque la entrada cambia durante la vida
     * del componente.
     */
    effect(() => {
      this.box().nativeElement.indeterminate = this.indeterminate();
    });
  }

  /**
   * EL EVENTO NATIVO SE FRENA ACÁ: este componente publica `checkedChange` y el
   * `<input>` de abajo es un detalle. Dejar burbujear su `change` le daría al
   * consumidor un segundo evento sin documentar cuyo target es ese elemento
   * privado.
   *
   * `indeterminate` NO se limpia: es la afirmación del consumidor sobre otras
   * cosas y solo él sabe si este clic la resolvió. Adivinar haría parpadear la
   * casilla de «seleccionar todo» en un clic que no seleccionó todo.
   */
  protected onNativeChange(event: Event): void {
    event.stopPropagation();
    const value = (event.target as HTMLInputElement).checked;
    this.commit(value);
    this.checkedChange.emit(value);
  }

  protected onBlur(): void {
    this.markTouched();
  }
}
