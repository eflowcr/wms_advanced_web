import { TestBed } from '@angular/core/testing';
import { SessionContext } from '@ewms/core';
import { TABLE_VIEWS_VERSION, type TableViewsDocument } from '@ewms/design-system';
import { BrowserTableViewStore, TABLE_VIEWS_STORAGE_PREFIX } from './table-views.store';

/** Un almacenamiento en memoria con la forma de `Storage`: la prueba no toca el del navegador. */
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

const DOCUMENT: TableViewsDocument = {
  version: TABLE_VIEWS_VERSION,
  views: [
    {
      id: 'a',
      name: 'Pendientes',
      state: {
        view: { order: ['code'], hidden: [], widths: {}, pinned: {}, density: 'sm' },
        filters: { status: ['pendiente'] },
        sort: [],
      },
    },
  ],
  defaultId: 'a',
};

describe('BrowserTableViewStore', () => {
  let storage: MemoryStorage;
  let store: BrowserTableViewStore;

  beforeEach(() => {
    storage = new MemoryStorage();
    store = TestBed.runInInjectionContext(() => new BrowserTableViewStore(storage));
  });

  it('KEYS BY USER AND TABLE: another user does not see these views', async () => {
    await store.write('expediciones', DOCUMENT);
    expect(storage.key(0)).toBe(`${TABLE_VIEWS_STORAGE_PREFIX}.Operador.expediciones`);
    expect(await store.read('expediciones')).toEqual(DOCUMENT);

    TestBed.inject(SessionContext).setUser({ name: 'Ana Mora', initials: 'AM' });
    expect(await store.read('expediciones')).toBeNull();
  });

  it('forgets what it cannot read: broken JSON or another version', async () => {
    const key = `${TABLE_VIEWS_STORAGE_PREFIX}.Operador.expediciones`;
    storage.setItem(key, '{roto');
    expect(await store.read('expediciones')).toBeNull();
    expect(storage.getItem(key)).toBeNull();

    storage.setItem(key, JSON.stringify({ ...DOCUMENT, version: 99 }));
    expect(await store.read('expediciones')).toBeNull();
    expect(storage.getItem(key)).toBeNull();
  });

  it('without storage it still answers: nothing saved, nothing thrown', async () => {
    const none = TestBed.runInInjectionContext(() => new BrowserTableViewStore(null));
    await none.write('expediciones', DOCUMENT);
    expect(await none.read('expediciones')).toBeNull();
  });

  it('a storage that throws (full, or blocked by the browser) never breaks the table', async () => {
    const failing = new MemoryStorage();
    const boom = (): never => {
      throw new Error('QuotaExceededError');
    };
    failing.setItem = boom;
    failing.getItem = boom;
    failing.removeItem = boom;
    const broken = TestBed.runInInjectionContext(() => new BrowserTableViewStore(failing));
    await expect(broken.write('expediciones', DOCUMENT)).resolves.toBeUndefined();
    await expect(broken.read('expediciones')).resolves.toBeNull();
  });

  it('by default it is the browser storage; if the browser forbids it, there is none', async () => {
    const own = TestBed.runInInjectionContext(() => new BrowserTableViewStore());
    await own.write('propia', DOCUMENT);
    expect(await own.read('propia')).toEqual(DOCUMENT);
    await own.write('propia', { ...DOCUMENT, views: [] });

    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError');
      },
    });
    try {
      const blocked = TestBed.runInInjectionContext(() => new BrowserTableViewStore());
      expect(await blocked.read('propia')).toBeNull();
    } finally {
      Object.defineProperty(window, 'localStorage', original!);
    }
  });
});
