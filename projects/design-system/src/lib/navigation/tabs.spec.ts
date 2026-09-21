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

  it('has no axe violations in either mode', async () => {
    await expectNoAxeViolations(fixture.nativeElement);

    host.mode.set('section');
    await settle();
    await expectNoAxeViolations(fixture.nativeElement);
  });
});
