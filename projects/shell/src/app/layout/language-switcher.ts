import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  inject,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { LANGUAGES, LanguageService, type Language } from '@ewms/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * PROVISIONAL language switcher: a native <select>, enough to switch language
 * without reloading and to drive the e2e tests. It is replaced by the styled
 * control once the design system has Button and Select (see i18n.md in the
 * vault, "Conmutador de idioma").
 *
 * Each language is labelled in its own language ("Español", "English"), so a
 * user who cannot read the current one still finds theirs.
 *
 * It also shows the notice when a dictionary fails to load (case A in i18n.md,
 * "Cuando el diccionario no carga"): the interface stays in the current
 * language, and the person is told so next to the control they just used.
 */
@Component({
  imports: [TranslocoPipe],
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitcher {
  protected readonly language = inject(LanguageService);
  private readonly control = viewChild.required<ElementRef<HTMLSelectElement>>('control');

  /**
   * Keys written out literally, never built by concatenation; the marker
   * below is how transloco-keys-manager sees them.
   * t(common.languages.es, common.languages.en)
   */
  protected readonly labels: Readonly<Record<Language, string>> = {
    es: 'common.languages.es',
    en: 'common.languages.en',
  };

  constructor() {
    // The value lives on the <select> and follows `active()`, whoever changed
    // the language. Not `[value]` in the template: that binding runs before
    // @for creates the <option>s, so on the first render the browser has no
    // option to select and shows the first one (language-switcher.spec.ts
    // fails on exactly that). After render, the options exist.
    afterRenderEffect({
      write: () => {
        this.control().nativeElement.value = this.language.active();
      },
    });
  }

  protected async select(event: Event): Promise<void> {
    const control = event.target as HTMLSelectElement;
    const language = LANGUAGES.find((candidate) => candidate === control.value);
    if (language) {
      await this.language.use(language);
    }
    // A failed switch leaves `active()` unchanged, so the effect above does
    // not run again and the person's own pick would stay on screen. Put the
    // language actually shown back in the control.
    control.value = this.language.active();
  }
}
