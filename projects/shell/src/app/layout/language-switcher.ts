import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { LANGUAGES, LanguageService, type Language } from '@ewms/core';
import { Select, ToastService, type SelectOption } from '@ewms/design-system';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

/**
 * Conmutador de idioma sobre `ewms-select`; cada idioma escrito en el suyo, con su `lang`. Si un
 * diccionario no carga (caso A), vuelve al idioma en pantalla y lo avisa con un Toast.
 * Ver vault: 08-Sistema-de-Diseno/i18n.
 */
@Component({
  imports: [Select, TranslocoPipe],
  selector: 'app-language-switcher',
  templateUrl: './language-switcher.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-32 shrink-0', 'data-language-switcher': '' },
})
export class LanguageSwitcher {
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly toasts = inject(ToastService);

  /**
   * Claves literales; el marcador es lo que ve transloco-keys-manager.
   * t(common.languages.es, common.languages.en)
   */
  private readonly labels: Readonly<Record<Language, string>> = {
    es: 'common.languages.es',
    en: 'common.languages.en',
  };

  /** Se leen tras cada cambio: el diccionario del idioma activo es el que está cargado. */
  protected readonly options = computed<readonly SelectOption[]>(() => {
    this.language.active();
    return LANGUAGES.map((lang) => ({
      label: this.transloco.translate(this.labels[lang]),
      value: lang,
      lang,
    }));
  });

  private readonly field = viewChild.required(Select);

  /** El aviso del caso A en pantalla, para quitarlo cuando un cambio sale bien. */
  private notice: number | null = null;

  constructor() {
    // También al arrancar: una preferencia guardada que no carga deja la app en el por defecto.
    effect(() => {
      const failed = this.language.unavailable();
      untracked(() => (failed === null ? this.clearNotice() : this.showNotice()));
    });
  }

  protected async select(value: unknown): Promise<void> {
    const language = LANGUAGES.find((candidate) => candidate === value);
    if (language === undefined || language === this.language.active()) {
      return;
    }
    await this.language.use(language);
    // Tras un fallo `active()` no cambió y el enlace no tiene nada que empujar: el campo, que ya
    // mostraba lo elegido, vuelve a mano al idioma que de verdad está en pantalla.
    this.field().value.set(this.language.active());
    if (this.language.unavailable() !== null) {
      this.showNotice();
    }
  }

  /** Duración 0: se lee y se cierra con Escape, o se va sola cuando el idioma carga. */
  private showNotice(): void {
    if (this.notice !== null && this.toasts.toasts().some(({ id }) => id === this.notice)) {
      return;
    }
    this.notice = this.toasts.show(
      'warning',
      this.transloco.translate('shell.languageSwitcher.unavailable'),
      0,
    );
  }

  private clearNotice(): void {
    if (this.notice !== null) {
      this.toasts.dismiss(this.notice);
      this.notice = null;
    }
  }
}
