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

/** localStorage key of the saved preference. */
export const LANGUAGE_STORAGE_KEY = 'ewms.lang';

/**
 * Where the preference is saved. Internal to @ewms/core: specs replace it with
 * an in-memory Storage, so no test ever touches localStorage directly and the
 * lint exception below stays the only one.
 */
export const LANGUAGE_STORAGE = new InjectionToken<Storage | null>('LANGUAGE_STORAGE', {
  providedIn: 'root',
  factory: preferenceStorage,
});

/**
 * Startup could not load the default dictionary, so there is nothing to paint
 * with. The app initializer rejects with this error and Angular aborts the
 * bootstrap; the shell catches it and reveals the static notice in index.html,
 * which does not depend on i18n (i18n.md, "Cuando el diccionario no carga").
 */
export class DictionaryUnavailableError extends Error {
  constructor(readonly language: Language) {
    super(`i18n: the '${language}' dictionary could not be loaded; the app cannot start.`);
    this.name = 'DictionaryUnavailableError';
  }
}

/** What happened to one request to apply a language. */
type Outcome = 'applied' | 'overtaken' | 'failed';

/**
 * The active interface language: resolution at startup, hot switching,
 * persistence and `<html lang>` (ADR 0008).
 *
 * Nothing else in the app calls TranslocoService.setActiveLang: every change
 * of language goes through `use()`, so the dictionary, the locale, the
 * document language and the saved preference can never drift apart.
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
   * The language whose dictionary failed to load on the last attempt, while
   * the interface stayed in `active()`. Null once a change succeeds. The UI
   * reads it to tell the user; it is never a reason to render nothing.
   */
  readonly unavailable: Signal<Language | null> = this.failed.asReadonly();

  /**
   * Startup. Resolves and applies the initial language without saving it: a
   * user who never chose keeps following their browser.
   *
   * If the resolved language fails to load, startup falls back to the default
   * one and flags `unavailable()`. Only when the default dictionary fails too
   * does it reject, with DictionaryUnavailableError.
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

  /**
   * An explicit choice by the user: applied without reloading, and saved.
   *
   * If its dictionary fails to load, the current language stays on screen,
   * nothing is saved, and `unavailable()` names the language that failed.
   */
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
   * In this exact order:
   *   1. the saved preference (`ewms.lang`), only if it is a known language;
   *   2. the browser language, prefix only (`es-ES` -> `es`);
   *   3. `es`.
   *
   * Whatever is in localStorage is untrusted: an unknown value is ignored and
   * resolution moves on, it is never passed to Transloco.
   *
   * EXTENSION POINT, when login exists: the preference saved on the server
   * wins over everything below and goes first here. There is no such API yet;
   * do not invent one. Until then, localStorage is the only store (ADR 0008).
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
   * Loads the dictionary BEFORE switching, so the screen goes from one
   * complete language to the other with no frame of missing text.
   *
   * A call overtaken by a later one reports 'overtaken' even if its load
   * failed: only the last request speaks for what is on screen. A failed load
   * changes nothing, so the language already shown keeps working.
   */
  private async apply(language: Language): Promise<Outcome> {
    const request = ++this.request;
    let loaded = true;
    try {
      await firstValueFrom(this.transloco.load(language));
    } catch {
      // Transloco's own fallback is disabled (NoFallbackStrategy), so this is
      // the only place a failed load is handled.
      loaded = false;
    }
    if (request !== this.request) {
      return 'overtaken';
    }
    if (!loaded) {
      return 'failed';
    }
    this.transloco.setActiveLang(language);
    // Not cosmetic: without it a screen reader reads Spanish with English
    // phonetics, and axe flags the page.
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
      // Storage full or disabled (private mode): the choice still applies for
      // this session, it just is not remembered.
    }
  }
}

/**
 * The single place in the codebase that touches localStorage for the language.
 * Accessing it can throw when storage is disabled, hence the try/catch.
 */
function preferenceStorage(): Storage | null {
  try {
    // eslint-disable-next-line no-restricted-globals -- ADR 0008: the interface language is a non-sensitive UI preference, not a token. It moves to the server-side user profile once login exists.
    return localStorage;
  } catch {
    return null;
  }
}
