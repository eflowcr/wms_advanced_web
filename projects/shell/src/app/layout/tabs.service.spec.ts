import { TestBed } from '@angular/core/testing';
import { MAX_OPEN_TABS, TabsService } from './tabs.service';

/**
 * The open documents, as arithmetic.
 *
 * Everything interesting about an MDI strip is a question about a list --
 * which tab is next when you close this one, what happens at the limit -- and
 * none of it needs a router or a browser to answer. The parts that DO need a
 * browser (the focus after a close, the toast at the limit) are asserted in
 * `e2e/smoke.e2e.ts`.
 */
describe('TabsService', () => {
  let tabs: TabsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    tabs = TestBed.inject(TabsService);
  });

  it('starts with nothing open', () => {
    expect(tabs.tabs()).toEqual([]);
    expect(tabs.activeRoute()).toBeNull();
  });

  it('opens a route once and activates it', () => {
    expect(tabs.activate('/articulos', 'Artículos')).toBe(true);
    expect(tabs.activate('/articulos', 'Artículos')).toBe(true);

    expect(tabs.tabs()).toHaveLength(1);
    expect(tabs.activeRoute()).toBe('/articulos');
  });

  it('activating an already-open route does not move it in the strip', () => {
    tabs.activate('/a', 'A');
    tabs.activate('/b', 'B');
    tabs.activate('/a', 'A');

    expect(tabs.tabs().map((tab) => tab.route)).toEqual(['/a', '/b']);
    expect(tabs.activeRoute()).toBe('/a');
  });

  it('relabels an open tab, so a language change reaches the strip', () => {
    tabs.activate('/articulos', 'Artículos');
    tabs.relabel('/articulos', 'Articles');

    expect(tabs.tabs()[0]?.label).toBe('Articles');
  });

  it('relabelling something that is not open is not an error', () => {
    tabs.relabel('/nowhere', 'X');

    expect(tabs.tabs()).toEqual([]);
  });

  describe(`at the limit of ${MAX_OPEN_TABS}`, () => {
    beforeEach(() => {
      for (let index = 0; index < MAX_OPEN_TABS; index += 1) {
        tabs.activate(`/r${index}`, `R${index}`);
      }
    });

    it('is full, and says so', () => {
      expect(tabs.isFull()).toBe(true);
      expect(tabs.tabs()).toHaveLength(MAX_OPEN_TABS);
    });

    it('REFUSES the next one rather than dropping the oldest', () => {
      // Closing somebody's work without being asked is worse than telling them
      // the strip is full. The caller raises the warning; this returns false.
      expect(tabs.activate('/one-more', 'Una más')).toBe(false);

      expect(tabs.tabs()).toHaveLength(MAX_OPEN_TABS);
      expect(tabs.tabs().map((tab) => tab.route)).toContain('/r0');
    });

    it('but still ACTIVATES the route, so the screen is shown', () => {
      // The strip could not take it; the navigation still happened, and a
      // screen showing with no tab is better than a screen that does not show.
      tabs.activate('/one-more', 'Una más');

      expect(tabs.activeRoute()).toBe('/one-more');
    });

    it('and takes one again as soon as there is room', () => {
      tabs.close('/r0');

      expect(tabs.isFull()).toBe(false);
      expect(tabs.activate('/one-more', 'Una más')).toBe(true);
    });
  });

  describe('closing', () => {
    beforeEach(() => {
      tabs.activate('/a', 'A');
      tabs.activate('/b', 'B');
      tabs.activate('/c', 'C');
    });

    it('closing the ACTIVE one goes to the NEIGHBOUR, not to the first', () => {
      // Closing the third of five and landing on the first is a jump nobody
      // asked for.
      tabs.activate('/b', 'B');

      expect(tabs.close('/b')).toBe('/c');
      expect(tabs.activeRoute()).toBe('/c');
    });

    it('closing the last one in the strip falls back to the one before it', () => {
      expect(tabs.close('/c')).toBe('/b');
    });

    it('closing one that is NOT active leaves the active one alone', () => {
      tabs.activate('/c', 'C');

      expect(tabs.close('/a')).toBe('/c');
      expect(tabs.activeRoute()).toBe('/c');
    });

    it('closing the only one leaves nothing active, and says so', () => {
      tabs.close('/a');
      tabs.close('/b');

      expect(tabs.close('/c')).toBeNull();
      expect(tabs.tabs()).toEqual([]);
      expect(tabs.activeRoute()).toBeNull();
    });

    it('closing something that is not open changes nothing', () => {
      expect(tabs.close('/nowhere')).toBe('/c');
      expect(tabs.tabs()).toHaveLength(3);
    });
  });

  it('a tab can be declared unclosable, and carries that to the strip', () => {
    tabs.activate('/', 'Dashboard', false);

    expect(tabs.tabs()[0]?.closable).toBe(false);
  });
});
