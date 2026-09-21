import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '@ewms/testing';
import { TranslocoService } from '@jsverse/transloco';
import { TranslocoLocaleService } from '@jsverse/transloco-locale';
import {
  DictionaryUnavailableError,
  LANGUAGE_STORAGE,
  LANGUAGE_STORAGE_KEY,
  LanguageService,
} from './language.service';
import { resolveMissingKey } from './missing-handler';

const DICTIONARIES = {
  es: {
    greeting: 'Hola, {{ name }}',
    units: '{count, plural, =0 {Sin bultos} one {# bulto} other {# bultos}}',
  },
  en: {
    greeting: 'Hello, {{ name }}',
    units: '{count, plural, =0 {No packages} one {# package} other {# packages}}',
  },
};

/** Reemplazo de localStorage en memoria. */
class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  get length(): number {
    return this.items.size;
  }
  clear(): void {
    this.items.clear();
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

/** Almacenamiento deshabilitado, como en algunos modos privados: todo acceso lanza. */
class BrokenStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new DOMException('denied', 'SecurityError');
  }
  override setItem(): void {
    throw new DOMException('full', 'QuotaExceededError');
  }
}

function browserLanguage(value: string): void {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(value);
}

/** Dejar un idioma fuera de los diccionarios hace fallar su carga. */
async function start(
  storage: Storage = new MemoryStorage(),
  dictionaries: Partial<typeof DICTIONARIES> = DICTIONARIES,
): Promise<LanguageService> {
  TestBed.configureTestingModule({
    providers: [
      provideI18nTesting(dictionaries),
      { provide: LANGUAGE_STORAGE, useValue: storage },
    ],
  });
  const service = TestBed.inject(LanguageService);
  await TestBed.inject(ApplicationInitStatus).donePromise;
  return service;
}

describe('LanguageService', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    document.documentElement.lang = '';
  });

  afterEach(() => vi.restoreAllMocks());

  describe('initial language', () => {
    it('1. uses the saved preference first', async () => {
      storage.setItem(LANGUAGE_STORAGE_KEY, 'en');
      browserLanguage('es-CR');

      expect((await start(storage)).active()).toBe('en');
    });

    it.each(['fr', 'EN', '', '<img src=x>', '{"lang":"en"}'])(
      'ignores a saved value that is not a known language (%j) and moves on',
      async (garbage) => {
        storage.setItem(LANGUAGE_STORAGE_KEY, garbage);
        browserLanguage('en-GB');

        expect((await start(storage)).active()).toBe('en');
      },
    );

    it('2. takes only the prefix of the browser language', async () => {
      browserLanguage('en-GB');

      expect((await start(storage)).active()).toBe('en');
    });

    it('3. falls back to es', async () => {
      browserLanguage('fr-FR');

      expect((await start(storage)).active()).toBe('es');
    });

    it('applies the language at startup, sets <html lang>, and does not save it', async () => {
      browserLanguage('en-US');

      await start(storage);

      expect(document.documentElement.lang).toBe('en');
      expect(TestBed.inject(TranslocoService).translate('greeting', { name: 'Ana' })).toBe(
        'Hello, Ana',
      );
      expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
    });

    it('moves on to the browser language when storage cannot be read', async () => {
      browserLanguage('en-US');

      expect((await start(new BrokenStorage())).active()).toBe('en');
    });
  });

  describe('use()', () => {
    it('switches dictionary and locale, persists the choice and updates <html lang>', async () => {
      browserLanguage('es-CR');
      const service = await start(storage);
      const transloco = TestBed.inject(TranslocoService);
      expect(transloco.translate('units', { count: 1 })).toBe('1 bulto');

      await service.use('en');

      expect(service.active()).toBe('en');
      expect(transloco.translate('units', { count: 1 })).toBe('1 package');
      expect(TestBed.inject(TranslocoLocaleService).getLocale()).toBe('en-US');
      expect(document.documentElement.lang).toBe('en');
      expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    });

    it('lets the last call win when two switches overlap', async () => {
      browserLanguage('es-CR');
      const service = await start(storage);

      await Promise.all([service.use('en'), service.use('es')]);

      expect(service.active()).toBe('es');
      expect(document.documentElement.lang).toBe('es');
      expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
    });

    it('still switches when the choice cannot be saved', async () => {
      browserLanguage('es-CR');
      const service = await start(new BrokenStorage());

      await service.use('en');

      expect(service.active()).toBe('en');
      expect(document.documentElement.lang).toBe('en');
    });
  });

  describe('a dictionary that does not load', () => {
    it('case A: keeps the current language working, saves nothing and flags the failure', async () => {
      browserLanguage('es-CR');
      const service = await start(storage, { es: DICTIONARIES.es });
      const transloco = TestBed.inject(TranslocoService);

      await service.use('en');

      expect(service.active()).toBe('es');
      expect(transloco.translate('units', { count: 1 })).toBe('1 bulto');
      expect(document.documentElement.lang).toBe('es');
      expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();
      expect(service.unavailable()).toBe('en');
    });

    it('case A: does not overwrite a preference saved earlier', async () => {
      storage.setItem(LANGUAGE_STORAGE_KEY, 'es');
      const service = await start(storage, { es: DICTIONARIES.es });

      await service.use('en');

      expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
    });

    it('clears the failure once a later change succeeds', async () => {
      browserLanguage('es-CR');
      const service = await start(storage, { es: DICTIONARIES.es });
      await service.use('en');

      await service.use('es');

      expect(service.unavailable()).toBeNull();
    });

    it('does not report a failed load that a later switch overtook', async () => {
      browserLanguage('es-CR');
      const service = await start(storage, { es: DICTIONARIES.es });

      await Promise.all([service.use('en'), service.use('es')]);

      expect(service.active()).toBe('es');
      expect(service.unavailable()).toBeNull();
    });

    it('case A at startup: falls back to the default language and flags the saved one', async () => {
      storage.setItem(LANGUAGE_STORAGE_KEY, 'en');

      const service = await start(storage, { es: DICTIONARIES.es });

      expect(service.active()).toBe('es');
      expect(document.documentElement.lang).toBe('es');
      expect(service.unavailable()).toBe('en');
      // La preferencia es del usuario: que hoy falle un diccionario no la borra.
      expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    });

    it('case B: startup rejects with DictionaryUnavailableError when the default one fails', async () => {
      browserLanguage('es-CR');

      await expect(start(storage, { en: DICTIONARIES.en })).rejects.toBeInstanceOf(
        DictionaryUnavailableError,
      );
      expect(document.documentElement.lang).toBe('');
    });

    it('case B: tries the default language after the resolved one, never the others', async () => {
      browserLanguage('en-US');

      await expect(start(storage, {})).rejects.toMatchObject({ language: 'es' });
    });
  });

  describe('missing key', () => {
    it('throws in development', async () => {
      browserLanguage('es-CR');
      await start(storage);

      expect(() => TestBed.inject(TranslocoService).translate('inventory.title')).toThrow(
        /missing key 'inventory\.title' in 'es'/,
      );
    });

    it('returns the key path in production, never an empty string', () => {
      expect(resolveMissingKey('inventory.title', 'es', false)).toBe('inventory.title');
    });
  });
});
