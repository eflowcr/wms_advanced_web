import { DOCUMENT } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  InjectionToken,
  signal,
  type Signal,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGES, type Language } from './language.types';

/** Clave de localStorage de la preferencia. */
export const LANGUAGE_STORAGE_KEY = 'ewms.lang';

/** Interno: las specs lo cambian por un Storage en memoria, así la excepción de lint es única. */
export const LANGUAGE_STORAGE = new InjectionToken<Storage | null>('LANGUAGE_STORAGE', {
  providedIn: 'root',
  factory: preferenceStorage,
});

/**
 * No cargó el diccionario por defecto: Angular aborta el arranque y el shell revela el aviso
 * estático de index.html (caso B de i18n.md).
 */
export class DictionaryUnavailableError extends Error {
  constructor(readonly language: Language) {
    super(`i18n: the '${language}' dictionary could not be loaded; the app cannot start.`);
    this.name = 'DictionaryUnavailableError';
  }
}

/** Resultado de un pedido de aplicar un idioma. */
type Outcome = 'applied' | 'overtaken' | 'failed';

/**
 * Idioma activo: resolución al arrancar, cambio en caliente, persistencia y `<html lang>`
 * (ADR 0008). Todo cambio pasa por `use()`: diccionario, locale y preferencia no se separan.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(LANGUAGE_STORAGE);
  private readonly failed = signal<Language | null>(null);
  private request = 0;

  readonly languages: readonly Language[] = LANGUAGES;

  readonly active: Signal<Language> = computed(() => {
    const lang = this.transloco.activeLang();
    return isLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  });

  /**
   * El idioma que no cargó en el último intento (la interfaz sigue en `active()`); null tras
   * un cambio exitoso. Sirve para avisar, nunca para no pintar.
   */
  readonly unavailable: Signal<Language | null> = this.failed.asReadonly();

  /**
   * Aplica el idioma inicial sin guardarlo: quien nunca eligió sigue a su navegador. Si falla,
   * cae al por defecto y marca `unavailable()`; si ese también falla, lanza.
   */
  async init(): Promise<void> {
    const initial = this.resolveInitial();
    if ((await this.apply(initial)) !== 'failed') {
      return;
    }
    if (initial !== DEFAULT_LANGUAGE) {
      this.failed.set(initial);
      if ((await this.apply(DEFAULT_LANGUAGE)) !== 'failed') {
        return;
      }
    }
    throw new DictionaryUnavailableError(DEFAULT_LANGUAGE);
  }

  /** Elección del usuario: se aplica sin recargar y se guarda. Si falla, no cambia nada. */
  async use(language: Language): Promise<void> {
    const outcome = await this.apply(language);
    if (outcome === 'applied') {
      this.failed.set(null);
      this.persist(language);
    } else if (outcome === 'failed') {
      this.failed.set(language);
    }
  }

  /**
   * Preferencia guardada (solo si es un idioma conocido: localStorage no es de fiar), prefijo del
   * navegador (`es-ES` -> `es`), `es`. Punto de extensión: con login, la preferencia del servidor
   * va primero; esa API todavía no existe.
   */
  resolveInitial(): Language {
    const saved = this.readSaved();
    if (isLanguage(saved)) {
      return saved;
    }
    const browser = (this.document.defaultView?.navigator.language ?? '')
      .split('-')[0]
      ?.toLowerCase();
    if (isLanguage(browser)) {
      return browser;
    }
    return DEFAULT_LANGUAGE;
  }

  /**
   * Carga antes de cambiar, sin un cuadro con texto faltante. Una llamada adelantada dice
   * 'overtaken' aunque haya fallado: solo la última habla por lo que hay en pantalla.
   */
  private async apply(language: Language): Promise<Outcome> {
    const request = ++this.request;
    let loaded = true;
    try {
      await firstValueFrom(this.transloco.load(language));
    } catch {
      // Con el fallback de Transloco apagado, este es el único lugar que maneja el fallo.
      loaded = false;
    }
    if (request !== this.request) {
      return 'overtaken';
    }
    if (!loaded) {
      return 'failed';
    }
    this.transloco.setActiveLang(language);
    // Sin esto un lector de pantalla pronuncia el español con fonética inglesa, y axe lo marca.
    this.document.documentElement.lang = language;
    return 'applied';
  }

  private readSaved(): string | null {
    try {
      return this.storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private persist(language: Language): void {
    try {
      this.storage?.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Almacenamiento lleno o deshabilitado: la elección vale en esta sesión, sin recordarse.
    }
  }
}

/** El único lugar que toca localStorage por el idioma; acceder lanza si está deshabilitado. */
function preferenceStorage(): Storage | null {
  try {
    // eslint-disable-next-line no-restricted-globals -- ADR 0008: el idioma de interfaz es una preferencia no sensible, no un token. Pasa al perfil del usuario en el servidor cuando exista login.
    return localStorage;
  } catch {
    return null;
  }
}
