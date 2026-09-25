import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { Tabs, type TabsMode } from './tabs';
import type { Tab } from './navigation.types';

const TABS: readonly Tab[] = [
  { id: 'articles', label: 'Artículos' },
  { id: 'clients', label: 'Clientes' },
  { id: 'pinned', label: 'Dashboard', closable: false },
  { id: 'off', label: 'Deshabilitada', disabled: true },
];

@Component({
  template: `
    <ewms-tabs
      [tabs]="tabs()"
      [activeId]="activeId()"
      [mode]="mode()"
      label="Documentos abiertos"
      scrollBackLabel="Ver las anteriores"
      scrollForwardLabel="Ver las siguientes"
      (tabSelect)="chosen = $event.id"
      (tabClose)="closed = $event.id"
    />
  `,
  imports: [Tabs],
})
class TestHost {
  readonly tabs = signal(TABS);
  readonly activeId = signal<string | null>('articles');
  readonly mode = signal<TabsMode>('document');

  chosen: string | null = null;
  closed: string | null = null;
}

describe('Tabs', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function tab(id: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[data-tab="${id}"]`) as HTMLButtonElement;
  }

  function press(id: string, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    tab(id).dispatchEvent(event);
    return event;
  }

  function closeGlyphs(): HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll('[data-tab-close]')] as HTMLElement[];
  }

  it('is a tablist with a name, and says which tab is selected', () => {
    const list = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;

    expect(list.getAttribute('aria-label')).toBe('Documentos abiertos');
    expect(tab('articles').getAttribute('aria-selected')).toBe('true');
    expect(tab('clients').getAttribute('aria-selected')).toBe('false');
  });

  it('renders NO tabpanel: the panel is the consumer`s router outlet', () => {
    expect(fixture.nativeElement.querySelector('[role="tabpanel"]')).toBeNull();
  });

  it('only the selected tab is in the tab order', () => {
    expect(tab('articles').tabIndex).toBe(0);
    expect(tab('clients').tabIndex).toBe(-1);
  });

  it('the close glyph is NOT a second tab stop, and Delete is announced instead', () => {
    // Un `tablist` solo tiene `tab`s: un botón acá es violación crítica de axe. Glifo no
    // enfocable, `Delete` y `aria-keyshortcuts`, como las APG.
    const glyph = closeGlyphs()[0]!;

    expect(glyph.getAttribute('aria-hidden')).toBe('true');
    expect(glyph.tabIndex).toBe(-1);
    expect(tab('articles').getAttribute('aria-keyshortcuts')).toBe('Delete');
  });

  it('a tab that says it cannot be closed has no close glyph and no shortcut', () => {
    expect(closeGlyphs().map((element) => element.dataset['tabClose'])).not.toContain('pinned');
    expect(tab('pinned').getAttribute('aria-keyshortcuts')).toBeNull();
  });

  it('a document tab is a pill chip: the selected one in navy, the rest in grey', () => {
    // La barra de chips de YouTube con la pintura del sistema (decisión del usuario, 2026-09-25).
    expect(tab('articles').className).toContain('rounded-full');
    expect(tab('articles').className).toContain('bg-brand-navy');
    expect(tab('clients').className).toContain('bg-chip');
    expect(tab('clients').className).not.toContain('bg-brand-navy');
  });

  it('section mode underlines the selected tab, and only that one', async () => {
    host.mode.set('section');
    await settle();

    const lines = [...fixture.nativeElement.querySelectorAll('[data-tab-indicator]')];
    expect(lines).toHaveLength(1);
    expect(tab('articles').contains(lines[0] as Node)).toBe(true);
    // Una sección no es un chip.
    expect(tab('articles').className).not.toContain('rounded-full');
  });

  it('section mode closes nothing at all: a section is not a document', async () => {
    host.mode.set('section');
    await settle();

    expect(closeGlyphs()).toHaveLength(0);
  });

  it('choosing a tab reports it', async () => {
    tab('clients').click();
    await settle();

    expect(host.chosen).toBe('clients');
  });

  it('a disabled tab is not chosen, by click or by arrow', async () => {
    tab('off').click();
    await settle();
    expect(host.chosen).toBeNull();

    // Las flechas también la saltean.
    press('pinned', 'ArrowRight');
    await settle();
    expect(host.chosen).toBe('articles');
  });

  describe('the keyboard', () => {
    it('the arrows move and select, and wrap around', async () => {
      press('articles', 'ArrowRight');
      await settle();
      expect(host.chosen).toBe('clients');

      press('articles', 'ArrowLeft');
      await settle();
      // Hacia atrás desde la primera cae en la última habilitada.
      expect(host.chosen).toBe('pinned');
    });

    it('Home and End jump to the ends', async () => {
      press('clients', 'End');
      await settle();
      expect(host.chosen).toBe('pinned');

      press('clients', 'Home');
      await settle();
      expect(host.chosen).toBe('articles');
    });

    it('Delete closes the tab you are on when it can be closed', async () => {
      press('clients', 'Delete');
      await settle();

      expect(host.closed).toBe('clients');
    });

    it('Delete on a tab that cannot be closed does nothing', async () => {
      press('pinned', 'Delete');
      await settle();

      expect(host.closed).toBeNull();
    });

    it('Delete in SECTION mode does nothing either', async () => {
      host.mode.set('section');
      await settle();

      press('clients', 'Delete');
      await settle();

      expect(host.closed).toBeNull();
    });

    it('a key the strip does not own is left to the browser', () => {
      expect(press('articles', 'a').defaultPrevented).toBe(false);
    });
  });

  it('closing is the CONSUMER`s to carry out: the strip only reports it', async () => {
    closeGlyphs()[0]?.click();
    await settle();

    expect(host.closed).toBe('articles');
    // Sigue ahí: la lista es una entrada y es del shell.
    expect(tab('articles')).not.toBeNull();
  });

  it('the close glyph closes WITHOUT also selecting the tab it sits in', async () => {
    host.activeId.set('clients');
    await settle();

    closeGlyphs()[0]?.click();
    await settle();

    expect(host.closed).toBe('articles');
    expect(host.chosen).toBeNull();
  });

  describe('when the strip overflows', () => {
    // jsdom no mide: el desborde y el desplazamiento se fijan a mano, como en la Tabla.
    let strip: HTMLElement;
    const back = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector('[data-tabs-back] button');
    const forward = (): HTMLButtonElement | null =>
      fixture.nativeElement.querySelector('[data-tabs-forward] button');

    async function lay(scrollLeft: number): Promise<void> {
      Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 900 });
      Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 300 });
      Object.defineProperty(strip, 'scrollLeft', { configurable: true, value: scrollLeft });
      strip.dispatchEvent(new Event('scroll'));
      await settle();
    }

    beforeEach(() => {
      document.body.appendChild(fixture.nativeElement);
      strip = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
    });

    afterEach(() => {
      fixture.nativeElement.remove();
    });

    it('shows the arrow of a side only while that side hides something', async () => {
      await lay(0);
      expect(back()).toBeNull();
      expect(forward()).not.toBeNull();

      await lay(300);
      expect(back()).not.toBeNull();
      expect(forward()).not.toBeNull();

      await lay(600);
      expect(back()).not.toBeNull();
      expect(forward()).toBeNull();
    });

    it('an arrow moves the strip by most of its width', async () => {
      await lay(0);
      const scrollBy = vi.fn();
      strip.scrollBy = scrollBy as unknown as typeof strip.scrollBy;

      forward()!.click();

      expect(scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' });
    });

    it('when the focused arrow goes away at the edge, the focus goes to the selected tab', async () => {
      await lay(300);
      back()!.focus();

      await lay(0);

      // No al body: habría que tabular la página entera para volver.
      expect(back()).toBeNull();
      expect(document.activeElement).toBe(tab('articles'));
    });

    it('section mode draws no arrows, overflow or not', async () => {
      host.mode.set('section');
      await settle();
      strip = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
      await lay(300);

      expect(back()).toBeNull();
      expect(forward()).toBeNull();
    });
  });

  describe('the selected tab stays in view', () => {
    function place(left: number, right: number): ReturnType<typeof vi.fn> {
      const strip = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
      strip.getBoundingClientRect = () => ({ left: 0, right: 300 }) as DOMRect;
      const target = tab('clients');
      target.getBoundingClientRect = () => ({ left, right }) as DOMRect;
      const scrollIntoView = vi.fn();
      target.scrollIntoView = scrollIntoView;
      return scrollIntoView;
    }

    it('is brought into view when it is not whole', async () => {
      const scrollIntoView = place(260, 380);
      host.activeId.set('clients');
      await settle();

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'center' });
    });

    it('and left alone when it already is: the strip does not jump on every click', async () => {
      const scrollIntoView = place(100, 200);
      host.activeId.set('clients');
      await settle();

      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  it('has no axe violations in either mode', async () => {
    await expectNoAxeViolations(fixture.nativeElement);

    host.mode.set('section');
    await settle();
    await expectNoAxeViolations(fixture.nativeElement);
  });
});
