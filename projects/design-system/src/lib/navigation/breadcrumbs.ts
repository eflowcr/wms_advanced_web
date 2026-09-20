import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { CRUMB_FOLD_THRESHOLD, foldCrumbs, type Crumb } from './navigation.types';

/**
 * DÓNDE ESTÁS, COMO UN CAMINO. Un `<ol>` dentro de un `<nav>` con nombre, porque
 * el orden es el significado. La última miga es la página actual, lleva
 * `aria-current="page"` y NO es un enlace.
 * EL PLIEGUE: pasados cinco niveles el medio colapsa en puntos suspensivos, y LOS
 * PUNTOS SON UN BOTÓN. Truncar etiquetas deja «Ubicaci…» y tirar el medio quita
 * en silencio navegación que se veía; un botón dice que el camino sigue.
 */
@Component({
  selector: 'ewms-breadcrumbs',
  templateUrl: './breadcrumbs.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0' },
})
export class Breadcrumbs {
  readonly items = input.required<readonly Crumb[]>();

  /** El nombre del landmark, ya traducido. Obligatorio, como el del rail. */
  readonly label = input.required<string>();

  /**
   * Cómo se llama el botón del pliegue, ya traducido. Dice qué hace y cuánto
   * esconde -«Mostrar 4 niveles ocultos»-, así que el consumidor recibe la cuenta
   * y escribe la frase. Un botón llamado «…» no tiene nombre accesible.
   */
  readonly expandLabel = input.required<(hidden: number) => string>();

  /** Se eligió una miga. La última nunca emite: no es un enlace. */
  readonly crumbSelect = output<Crumb>();

  /** El pliegue, abierto por la persona. Se cierra al cambiar el rastro. */
  private readonly unfolded = signal(false);

  protected readonly threshold = CRUMB_FOLD_THRESHOLD;

  private readonly folded = computed(() => foldCrumbs(this.items(), this.unfolded()));

  protected readonly visible = computed(() => this.folded().visible);
  protected readonly hidden = computed(() => this.folded().folded);

  protected isLast(crumb: Crumb): boolean {
    const visible = this.visible();
    return visible[visible.length - 1] === crumb;
  }

  /** El pliegue va entre la primera miga y el resto, cuando lo hay. */
  protected showsFoldAfter(crumb: Crumb): boolean {
    return this.hidden() > 0 && this.visible()[0] === crumb;
  }

  protected onExpand(): void {
    this.unfolded.set(true);
  }

  protected onSelect(crumb: Crumb): void {
    this.crumbSelect.emit(crumb);
  }
}
