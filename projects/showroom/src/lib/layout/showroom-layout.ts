import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DESIGN_SYSTEM_VERSION } from '@ewms/design-system';
import { countEntries, filterCatalog, STATUS_LABELS } from '../catalog';
import { provideShowroomDesignSystem } from '../showroom.providers';

/**
 * The frame every showroom page renders inside: a fixed sidebar, a search box
 * over the catalogue, and the version of the design system on screen.
 *
 * IT IS THE SHOWROOM'S OWN LAYOUT, NOT THE SHELL'S. The shell's chrome wraps
 * this one (app.routes.ts mounts the showroom inside MainLayout) and is not
 * touched: the two answer to different people.
 *
 * NONE OF THIS USES A DESIGN-SYSTEM COMPONENT. The search field is a plain
 * `<input>` and the links are plain `<a>`, built from tokens by hand. If the
 * sidebar depended on the Button, a broken Button would take away the page
 * that documents the Button -- the tool that diagnoses cannot depend on what
 * it diagnoses (Showroom spec, section 5). The tokens are the same; the
 * components are not.
 */
@Component({
  selector: 'ewms-showroom-layout',
  templateUrl: './showroom-layout.html',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  /*
   * THE CATALOGUE'S OWN DICTIONARIES, ON THE COMPONENT AND NOT ON THE ROUTE.
   *
   * The shell provides its own on `MainLayout`, which this layout renders
   * inside. A component's providers live in the ELEMENT injector, and that
   * chain is walked before any environment injector -- so route-level
   * providers here lost to MainLayout's, and every showroom page quietly
   * showed the shell's strings in whatever language the application was in.
   * The table's row checkboxes reading "Select the row" in a Spanish-only
   * catalogue is how it was noticed.
   *
   * On the component they are nearer than MainLayout's and win, which is what
   * "the catalogue speaks for itself" has to mean.
   */
  providers: [provideShowroomDesignSystem()],
})
export class ShowroomLayout {
  /** Compile-time, from the library's package.json. Never typed in by hand. */
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly statusLabels = STATUS_LABELS;

  protected readonly query = signal('');

  /** The catalogue, filtered. One list, so the sidebar cannot drift from the index. */
  protected readonly sections = computed(() => filterCatalog(this.query()));
  protected readonly matches = computed(() => countEntries(this.sections()));
  protected readonly filtering = computed(() => this.query().trim().length > 0);

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
