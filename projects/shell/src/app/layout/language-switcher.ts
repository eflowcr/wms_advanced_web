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
 * Conmutador de idioma con un <select> nativo; cada idioma escrito en el suyo. Muestra el
 * aviso del caso A si un diccionario no carga.
 * Ver vault: 08-Sistema-de-Diseno/i18n.
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
   * Claves literales; el marcador es lo que ve transloco-keys-manager.
   * t(common.languages.es, common.languages.en)
   */
  protected readonly labels: Readonly<Record<Language, string>> = {
    es: 'common.languages.es',
    en: 'common.languages.en',
  };

  constructor() {
    // El valor sigue a `active()` y se escribe tras el render: `[value]` corre antes de que
    // @for cree las <option> y el navegador mostraría la primera (lo atrapa la spec).
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
    // Un cambio fallido no mueve `active()` y el efecto no corre: se repone a mano el
    // idioma que de verdad está en pantalla.
    control.value = this.language.active();
  }
}
