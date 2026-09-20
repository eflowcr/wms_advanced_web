import { Component, computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { Favorites } from './favorites';
import { FavoriteToggle } from './favorite-toggle';
import { FavoritesNav, FAVORITES_SHOWN } from './favorites-nav';
import { InMemoryFavoritesStore } from './in-memory-favorites-store';
import {
  EWMS_FAVORITE_LABELS,
  EWMS_FAVORITES_STORE,
  type Favorite,
  type FavoriteLabelResolver,
  type FavoritesStore,
} from './favorites.types';

const ARTICLES: Favorite = { route: '/articulos' };
const CLIENTS: Favorite = { route: '/clientes' };

/**
 * The words, in two languages, the way an application would hold them. The
 * language is a signal so a test can switch it and watch the block follow.
 */
const language = signal<'es' | 'en'>('es');
const NAMES: Record<string, { es: string; en: string }> = {
  '/articulos': { es: 'Artículos', en: 'Items' },
  '/clientes': { es: 'Clientes', en: 'Customers' },
};
const LABELS: FavoriteLabelResolver = {
  labelFor: (route) => computed(() => NAMES[route]?.[language()] ?? ''),
  iconFor: (route) => (route === '/articulos' ? 'package' : null),
};

describe('InMemoryFavoritesStore', () => {
  let store: InMemoryFavoritesStore;

  beforeEach(() => {
    store = new InMemoryFavoritesStore();
  });

  it('starts empty', async () => {
    expect(await store.read()).toEqual([]);
  });

  it('adds ONE at a time, never replacing the list', async () => {
    // The same rule the backend contract asks for (REQ-FE-DS4-002 §12): two
    // tabs open must not overwrite one another.
    await store.add(ARTICLES);
    await store.add(CLIENTS);

    expect((await store.read()).map((favorite) => favorite.route)).toEqual([
      '/articulos',
      '/clientes',
    ]);
  });

  it('adding the same route twice does not duplicate it', async () => {
    await store.add(ARTICLES);
    await store.add({ ...ARTICLES, icon: 'operator' });

    expect(await store.read()).toHaveLength(1);
  });

  it('keeps INSERTION order, which is the stable order RFE-01 asks for', async () => {
    await store.add(CLIENTS);
    await store.add(ARTICLES);

    // Not alphabetical: sorting by name would reshuffle the block every time
    // the language changed.
    expect((await store.read()).map((favorite) => favorite.route)).toEqual([
      '/clientes',
      '/articulos',
    ]);
  });

  it('removes by route, and removing something absent is not an error', async () => {
    await store.add(ARTICLES);
    await store.remove('/articulos');
    await store.remove('/no-existe');

    expect(await store.read()).toEqual([]);
  });

  it('hands out a COPY: a caller cannot edit the list behind the store`s back', async () => {
    await store.add(ARTICLES);
    const list = (await store.read()) as Favorite[];
    list.push(CLIENTS);

    expect(await store.read()).toHaveLength(1);
  });
});

describe('Favorites', () => {
  function serviceWith(store: FavoritesStore): Favorites {
    TestBed.configureTestingModule({
      providers: [{ provide: EWMS_FAVORITES_STORE, useValue: store }, Favorites],
    });
    return TestBed.inject(Favorites);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('PACQ-01.1: marking puts it in the list and flips isFavorite', async () => {
    const favorites = serviceWith(new InMemoryFavoritesStore());
    const marked = favorites.isFavorite('/articulos');
    expect(marked()).toBe(false);

    await favorites.toggle('/articulos');

    expect(marked()).toBe(true);
    expect(favorites.list()).toHaveLength(1);
    expect(favorites.count()).toBe(1);
  });

  it('PACQ-01.2: toggling twice returns to exactly where it started', async () => {
    const favorites = serviceWith(new InMemoryFavoritesStore());

    await favorites.toggle('/articulos');
    await favorites.toggle('/articulos');

    expect(favorites.list()).toEqual([]);
    expect(favorites.isFavorite('/articulos')()).toBe(false);
  });

  it('PACQ-01.3: A DIFFERENT STORE, AND THE SERVICE DOES NOT CHANGE', async () => {
    // This is the proof that swapping to the backend costs one class. If this
    // test needed anything else, RFE-02 would not be met.
    const calls: string[] = [];
    const recording: FavoritesStore = {
      read: () => {
        calls.push('read');
        return Promise.resolve([CLIENTS]);
      },
      add: () => {
        calls.push('add');
        return Promise.resolve();
      },
      remove: () => {
        calls.push('remove');
        return Promise.resolve();
      },
    };

    const favorites = serviceWith(recording);
    await favorites.toggle('/articulos');

    expect(calls).toContain('add');
    expect(favorites.list()).toEqual([CLIENTS]);
  });

  it('THE STORE NEVER SEES A NAME: what is written is the route, and only the route', async () => {
    // REQ-FE-DS4-002 v1.3 §12. A name is presentation -- it depends on the
    // language and on what the screen is called tomorrow -- and a backend that
    // kept it would hand back lists half translated. `toEqual` on the whole
    // object, so a field added later fails here rather than reaching the wire.
    const written: Favorite[] = [];
    const recording: FavoritesStore = {
      read: () => Promise.resolve([...written]),
      add: (favorite) => {
        written.push(favorite);
        return Promise.resolve();
      },
      remove: () => Promise.resolve(),
    };

    await serviceWith(recording).toggle('/articulos');

    expect(written).toEqual([{ route: '/articulos' }]);
  });

  it('unmarking goes through `remove`, not through a rewritten list', async () => {
    const store = new InMemoryFavoritesStore();
    await store.add(ARTICLES);
    const favorites = serviceWith(store);
    // The constructor read is already in flight; wait for it before asserting.
    await Promise.resolve();

    await favorites.toggle('/articulos');

    expect(await store.read()).toEqual([]);
  });

  it('reads back FROM THE STORE after a write, rather than patching hopefully', async () => {
    // With the in-memory store the difference is invisible; with a backend it
    // is the difference between showing what was saved and what we hoped was.
    const rejecting: FavoritesStore = {
      read: () => Promise.resolve([]),
      add: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    };
    const favorites = serviceWith(rejecting);

    await favorites.toggle('/articulos');

    expect(favorites.list()).toEqual([]);
  });
});

@Component({
  template: `
    <ewms-favorite-toggle
      [route]="route"
      addLabel="Agregar a favoritos"
      removeLabel="Quitar de favoritos"
      addedMessage="Agregado a favoritos"
      removedMessage="Quitado de favoritos"
    />
    <ewms-favorites-nav
      label="Favoritos"
      emptyLabel="Marcá una pantalla con la estrella"
      [expanded]="expanded()"
      [activeRoute]="activeRoute()"
      (favoriteSelect)="chosen = $event.route"
    />
  `,
  imports: [FavoriteToggle, FavoritesNav],
  providers: [
    { provide: EWMS_FAVORITES_STORE, useClass: InMemoryFavoritesStore },
    Favorites,
    { provide: EWMS_FAVORITE_LABELS, useValue: LABELS },
  ],
})
class TestHost {
  readonly route = '/articulos';
  readonly expanded = signal(true);
  readonly activeRoute = signal<string | null>(null);
  chosen: string | null = null;
}

describe('the star and the block, together', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    language.set('es');
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  /**
   * The store's interface is asynchronous IN ITS FORM (RFE-02), so a toggle
   * costs several microtask turns even when the answer is immediate: write,
   * then read back, then set the signal. Draining them here is what makes the
   * tests describe the component rather than the number of `await`s inside it.
   */
  async function settle(): Promise<void> {
    for (let turn = 0; turn < 4; turn += 1) {
      await Promise.resolve();
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function star(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      '[data-favorite-toggle] button',
    ) as HTMLButtonElement;
  }

  function block(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-favorites-nav]') as HTMLElement;
  }

  it('PACQ-02.1: unmarked, the star is a two-state button that is not pressed', () => {
    expect(star().getAttribute('aria-pressed')).toBe('false');
    expect(star().getAttribute('aria-label')).toBe('Agregar a favoritos');
  });

  it('PACQ-03.1: with nothing marked the block is NOT a hole', () => {
    // A block that disappears makes somebody believe the feature is not there.
    expect(block()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-favorites-empty]')).not.toBeNull();
  });

  it('PACQ-02.2 and PACQ-03.2: marking flips the star AND fills the block', async () => {
    star().click();
    await settle();

    expect(star().getAttribute('aria-pressed')).toBe('true');
    // The name says what pressing it will do NOW, which is the opposite thing.
    expect(star().getAttribute('aria-label')).toBe('Quitar de favoritos');
    expect(block().textContent).toContain('Artículos');
    expect(fixture.nativeElement.querySelector('[data-favorites-empty]')).toBeNull();
  });

  it('RFE-05: the change is announced by a live region, not only by the state', async () => {
    star().click();
    await settle();

    const announce = fixture.nativeElement.querySelector('[data-favorite-announce]') as HTMLElement;
    expect(announce.getAttribute('role')).toBe('status');
    expect(announce.textContent?.trim()).toBe('Agregado a favoritos');

    star().click();
    await settle();
    expect(announce.textContent?.trim()).toBe('Quitado de favoritos');
  });

  it('the marked state is not colour alone: the control changes shape', async () => {
    // `ghost` has no box; `primary` is a filled one. WCAG 1.4.1.
    const before = star().className;
    star().click();
    await settle();

    expect(star().className).not.toBe(before);
  });

  it('a favourite in the block reports itself: ONE click from anywhere', async () => {
    star().click();
    await settle();

    (fixture.nativeElement.querySelector('[data-favorite="/articulos"]') as HTMLElement).click();
    await settle();

    expect(host.chosen).toBe('/articulos');
  });

  it('the block marks the favourite you are looking at', async () => {
    star().click();
    host.activeRoute.set('/articulos');
    await settle();

    expect(
      (
        fixture.nativeElement.querySelector('[data-favorite="/articulos"]') as HTMLElement
      ).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('collapsed, the block drops the labels and keeps the destinations', async () => {
    star().click();
    host.expanded.set(false);
    await settle();

    expect(fixture.nativeElement.querySelector('[data-favorite="/articulos"]')).not.toBeNull();
    expect(block().textContent).not.toContain('Artículos');
  });

  it('collapsed and empty, the empty state is an icon WITH A NAME and no tab stop', async () => {
    host.expanded.set(false);
    await settle();

    const empty = fixture.nativeElement.querySelector('[data-favorites-empty]') as HTMLElement;
    expect(empty.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Marcá una pantalla con la estrella',
    );
    // A `tabindex="0"` on a non-control is the defect the DS-2 keyboard walk
    // found on the Tooltip's own page.
    expect(empty.querySelector('[tabindex]')).toBeNull();
  });

  it(`shows at most ${FAVORITES_SHOWN}: past that the block stops being a shortcut`, async () => {
    // The service is provided on the HOST COMPONENT, so it lives in the
    // element injector -- `TestBed.inject` would look in the environment one
    // and find nothing. This is the same chain the shell and the showroom use.
    const favorites = fixture.componentRef.injector.get(Favorites);
    for (let index = 0; index < FAVORITES_SHOWN + 3; index += 1) {
      await favorites.toggle(`/r${index}`);
    }
    await settle();

    expect(fixture.nativeElement.querySelectorAll('[data-favorite]')).toHaveLength(FAVORITES_SHOWN);
  });

  it('THE NAME FOLLOWS THE LANGUAGE, without marking again and without a reload', async () => {
    // The defect v1.3 closes: «Artículos», marked in Spanish, stayed
    // «Artículos» in English because the name had been stored with the route.
    star().click();
    await settle();
    expect(block().textContent).toContain('Artículos');

    language.set('en');
    await settle();
    expect(block().textContent).toContain('Items');
    expect(block().textContent).not.toContain('Artículos');

    language.set('es');
    await settle();
    expect(block().textContent).toContain('Artículos');
  });

  it('A ROUTE NOBODY CAN NAME SHOWS ITSELF: never an empty row, never an error', async () => {
    // A screen that was removed leaves its favourite behind. The block shows
    // the route as it is and the row still works.
    const favorites = fixture.componentRef.injector.get(Favorites);
    await favorites.toggle('/pantalla-que-ya-no-existe');
    await settle();

    const selector = '[data-favorite="/pantalla-que-ya-no-existe"]';
    const row = fixture.nativeElement.querySelector(selector) as HTMLElement;
    expect(row.textContent?.trim()).toBe('/pantalla-que-ya-no-existe');
    // The neutral icon is drawn: a row is never text alone.
    expect(row.querySelector('svg')).not.toBeNull();

    // Collapsed there is no text at all, so the route is the accessible name.
    host.expanded.set(false);
    await settle();
    expect(
      (fixture.nativeElement.querySelector(selector) as HTMLElement).getAttribute('aria-label'),
    ).toBe('/pantalla-que-ya-no-existe');

    await expectNoAxeViolations(fixture.nativeElement);
  });

  it('is its own landmark, separate from the menu', () => {
    expect(block().getAttribute('aria-label')).toBe('Favoritos');
    expect(block().tagName).toBe('NAV');
  });

  it('PACQ-04.1: no axe violations, empty or full', async () => {
    await expectNoAxeViolations(fixture.nativeElement);

    star().click();
    await settle();
    await expectNoAxeViolations(fixture.nativeElement);
  });
});
