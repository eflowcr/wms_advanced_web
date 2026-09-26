import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Icon } from '../icon/icon';
import { foldCrumbs, type Crumb } from './navigation.types';

/** `<ol>` en un `<nav>` con nombre; la última miga es actual y no enlace. Ver vault: Navegacion. */
@Component({
  selector: 'ewms-breadcrumbs',
  templateUrl: './breadcrumbs.html',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0' },
})
export class Breadcrumbs {
  readonly items = input.required<readonly Crumb[]>();

  /** Obligatorio, como el del rail. */
  readonly label = input.required<string>();

  /** Recibe la cuenta y arma la frase («Mostrar 4 niveles ocultos»): «…» no es un nombre. */
  readonly expandLabel = input.required<(hidden: number) => string>();

  /** La última nunca emite: no es un enlace. */
  readonly crumbSelect = output<Crumb>();

  /** Abierto por la persona; se cierra al cambiar el rastro. */
  private readonly unfolded = signal(false);


  private readonly folded = computed(() => foldCrumbs(this.items(), this.unfolded()));

  protected readonly visible = computed(() => this.folded().visible);
  protected readonly hidden = computed(() => this.folded().folded);

  protected isLast(crumb: Crumb): boolean {
    const visible = this.visible();
    return visible[visible.length - 1] === crumb;
  }

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
