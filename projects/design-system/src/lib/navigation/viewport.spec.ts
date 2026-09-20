import { TestBed } from '@angular/core/testing';
import { NAV_BOTTOM_BREAKPOINT_TOKEN, Viewport } from './viewport';

/**
 * The breakpoint, read from the token.
 *
 * What is worth testing here is not `matchMedia` -- it is the fallback. The
 * token is the single source of the number, and the question "what happens
 * when the stylesheet is not there?" has a deliberate answer that a default
 * would have hidden.
 */
describe('Viewport', () => {
  /**
   * The breakpoint as a NUMBER, so the strings below are built rather than
   * written. A pixel literal in a spec is a raw value like any other and gate
   * 10 rejects it -- correctly: the number lives in tokens.css.
   */
  const BREAKPOINT = 768;
  const realMatchMedia = window.matchMedia;

  function stubMatchMedia(matches: boolean): { query: string | null } {
    const captured: { query: string | null } = { query: null };
    window.matchMedia = ((query: string) => {
      captured.query = query;
      return {
        matches,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        onchange: null,
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    }) as typeof window.matchMedia;
    return captured;
  }

  afterEach(() => {
    window.matchMedia = realMatchMedia;
    document.documentElement.style.removeProperty(NAV_BOTTOM_BREAKPOINT_TOKEN);
    TestBed.resetTestingModule();
  });

  it('asks the browser about the breakpoint the TOKEN declares', () => {
    document.documentElement.style.setProperty(
      NAV_BOTTOM_BREAKPOINT_TOKEN,
      `${BREAKPOINT}px`,
    );
    const captured = stubMatchMedia(true);

    const viewport = TestBed.inject(Viewport);

    expect(captured.query).toBe(`(min-width: ${BREAKPOINT}px)`);
    expect(viewport.isWide()).toBe(true);
  });

  it('follows the query when it says the viewport is narrow', () => {
    document.documentElement.style.setProperty(
      NAV_BOTTOM_BREAKPOINT_TOKEN,
      `${BREAKPOINT}px`,
    );
    stubMatchMedia(false);

    expect(TestBed.inject(Viewport).isWide()).toBe(false);
  });

  it('WITH NO TOKEN THE WIDE LAYOUT WINS, and that is a decision', () => {
    // No stylesheet, no number, no query to ask. The rail works at every
    // width -- it only costs space on a narrow screen. The bottom bar is the
    // one that would be wrong on a desktop, so it is not the fallback.
    const captured = stubMatchMedia(false);

    expect(TestBed.inject(Viewport).isWide()).toBe(true);
    expect(captured.query).toBeNull();
  });

  it('a token in a unit it cannot use is the same as no token', () => {
    // `readPixels` accepts px and nothing else, on purpose: a breakpoint in
    // `rem` moves with the browser's font size, which is a different feature.
    document.documentElement.style.setProperty(NAV_BOTTOM_BREAKPOINT_TOKEN, '48rem');
    stubMatchMedia(false);

    expect(TestBed.inject(Viewport).isWide()).toBe(true);
  });
});
