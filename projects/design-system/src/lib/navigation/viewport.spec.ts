import { TestBed } from '@angular/core/testing';
import { NAV_BOTTOM_BREAKPOINT_TOKEN, NAV_DRAWER_BREAKPOINT_TOKEN, Viewport } from './viewport';

// El punto de corte leído del token. Lo que se prueba es la reserva sin hoja de estilos.
describe('Viewport', () => {
  /** Como número: un literal en px en un spec es valor crudo y la compuerta 10 lo rechaza. */
  const BREAKPOINT = 768;
  const DRAWER_BREAKPOINT = 1280;
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
    document.documentElement.style.removeProperty(NAV_DRAWER_BREAKPOINT_TOKEN);
    TestBed.resetTestingModule();
  });

  it('asks the browser about the breakpoint the TOKEN declares', () => {
    document.documentElement.style.setProperty(NAV_BOTTOM_BREAKPOINT_TOKEN, `${BREAKPOINT}px`);
    const captured = stubMatchMedia(true);

    const viewport = TestBed.inject(Viewport);

    expect(captured.query).toBe(`(min-width: ${BREAKPOINT}px)`);
    expect(viewport.isWide()).toBe(true);
  });

  it('follows the query when it says the viewport is narrow', () => {
    document.documentElement.style.setProperty(NAV_BOTTOM_BREAKPOINT_TOKEN, `${BREAKPOINT}px`);
    stubMatchMedia(false);

    expect(TestBed.inject(Viewport).isWide()).toBe(false);
  });

  it('WITH NO TOKEN THE WIDE LAYOUT WINS, and that is a decision', () => {
    // Sin hoja no hay número: gana el rail, que anda a todo ancho; la barra inferior no.
    const captured = stubMatchMedia(false);

    expect(TestBed.inject(Viewport).isWide()).toBe(true);
    expect(captured.query).toBeNull();
  });

  it('asks about the drawer breakpoint too: under it the open panel is a drawer', () => {
    document.documentElement.style.setProperty(
      NAV_DRAWER_BREAKPOINT_TOKEN,
      `${DRAWER_BREAKPOINT}px`,
    );
    const captured = stubMatchMedia(false);

    const viewport = TestBed.inject(Viewport);

    expect(captured.query).toBe(`(min-width: ${DRAWER_BREAKPOINT}px)`);
    expect(viewport.panelFits()).toBe(false);
    // Sin el otro token la barra inferior no aparece: cada corte decide lo suyo.
    expect(viewport.isWide()).toBe(true);
  });

  it('WITH NO DRAWER TOKEN THE PANEL PUSHES, as it did before the drawer', () => {
    stubMatchMedia(false);

    expect(TestBed.inject(Viewport).panelFits()).toBe(true);
  });

  it('a token in a unit it cannot use is the same as no token', () => {
    // Solo px a propósito: un corte en `rem` se movería con la fuente del navegador.
    document.documentElement.style.setProperty(NAV_BOTTOM_BREAKPOINT_TOKEN, '48rem');
    stubMatchMedia(false);

    expect(TestBed.inject(Viewport).isWide()).toBe(true);
  });
});
