import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { NavRail } from './nav-rail';
import type { NavItem } from './navigation.types';

const TREE: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/' },
  {
    id: 'catalogs',
    label: 'Catálogos',
    icon: 'inventory',
    children: [
      { id: 'articles', label: 'Artículos', icon: 'package', route: '/articulos' },
      { id: 'clients', label: 'Clientes', icon: 'operator', route: '/clientes' },
    ],
  },
  { id: 'design', label: 'Sistema de diseño', icon: 'controls', route: '/design-system', badge: 3 },
];

@Component({
  template: `
    <ewms-nav-rail
      [items]="items()"
      label="Menú principal"
      toggleLabel="Contraer el menú"
      [activeId]="activeId()"
      [expanded]="expanded()"
      (itemSelect)="chosen = $event.id"
      (expandedChange)="askedWidth = $event"
    >
      <p navRailTop data-top>arriba</p>
      <p navRailFooter data-foot>abajo</p>
    </ewms-nav-rail>
  `,
  imports: [NavRail],
})
class TestHost {
  readonly items = signal(TREE);
  readonly activeId = signal<string | null>(null);
  readonly expanded = signal(true);

  chosen: string | null = null;
  askedWidth: boolean | null = null;
}

describe('NavRail', () => {
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

  function row(id: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[data-nav-item="${id}"]`) as HTMLButtonElement;
  }

  function rows(): HTMLButtonElement[] {
    return [...fixture.nativeElement.querySelectorAll('[data-nav-item]')];
  }

  function press(id: string, key: string): void {
    row(id).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }

  it('renders the top-level tree and keeps closed groups closed', () => {
    expect(rows().map((element) => element.dataset['navItem'])).toEqual([
      'dashboard',
      'catalogs',
      'design',
    ]);
  });

  it('projects what the consumer put above the tree and at its foot', () => {
    // El rail no sabe de favoritos: solo tiene ranuras.
    expect(fixture.nativeElement.querySelector('[data-top]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-foot]')).not.toBeNull();
  });

  it('a group OPENS and never navigates', async () => {
    row('catalogs').click();
    await settle();

    expect(host.chosen).toBeNull();
    expect(row('catalogs').getAttribute('aria-expanded')).toBe('true');
    expect(rows().map((element) => element.dataset['navItem'])).toContain('articles');
  });

  it('a destination reports itself', async () => {
    row('design').click();
    await settle();

    expect(host.chosen).toBe('design');
  });

  it('marks the page you are on with aria-current, and only that one', async () => {
    host.activeId.set('design');
    await settle();

    const current = fixture.nativeElement.querySelectorAll('[aria-current="page"]');
    expect(current.length).toBe(1);
    expect((current[0] as HTMLElement).dataset['navItem']).toBe('design');
  });

  it('OPENS THE GROUP THAT HOLDS THE ACTIVE ITEM, so the rail contains the page you are on', async () => {
    host.activeId.set('clients');
    await settle();

    expect(row('catalogs').getAttribute('aria-expanded')).toBe('true');
    expect(row('clients')).not.toBeNull();
  });

  describe('the treeview keyboard', () => {
    it('is ONE tab stop: exactly one row is tabbable', () => {
      const tabbable = rows().filter((element) => element.tabIndex === 0);

      expect(tabbable).toHaveLength(1);
    });

    it('the tabbable row is the active one when there is one', async () => {
      host.activeId.set('design');
      await settle();

      expect(row('design').tabIndex).toBe(0);
      expect(row('dashboard').tabIndex).toBe(-1);
    });

    it('the arrows walk the visible rows', async () => {
      press('dashboard', 'ArrowDown');
      await settle();

      expect(document.activeElement).toBe(row('catalogs'));
    });

    it('Right opens a closed group; Right again steps into it', async () => {
      press('catalogs', 'ArrowRight');
      await settle();
      expect(row('catalogs').getAttribute('aria-expanded')).toBe('true');

      press('catalogs', 'ArrowRight');
      await settle();
      expect(document.activeElement).toBe(row('articles'));
    });

    it('Left closes an open group, and climbs from a child to its group', async () => {
      press('catalogs', 'ArrowRight');
      await settle();

      press('clients', 'ArrowLeft');
      await settle();
      expect(document.activeElement).toBe(row('catalogs'));

      press('catalogs', 'ArrowLeft');
      await settle();
      expect(row('catalogs').getAttribute('aria-expanded')).toBe('false');
    });

    it('Home and End jump to the ends', async () => {
      press('design', 'Home');
      await settle();
      expect(document.activeElement).toBe(row('dashboard'));

      press('dashboard', 'End');
      await settle();
      expect(document.activeElement).toBe(row('design'));
    });

    it('a key the tree does not own is left to the browser', () => {
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      row('dashboard').dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });

    it('Enter is NOT intercepted: every row is a real button', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      row('dashboard').dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('collapsed', () => {
    beforeEach(async () => {
      host.expanded.set(false);
      await settle();
    });

    it('hides the labels', () => {
      expect(fixture.nativeElement.textContent).not.toContain('Sistema de diseño');
    });

    it('BUT EVERY ROW STILL HAS A NAME, which the tooltip alone does NOT give it', async () => {
      // Plegado no hay texto y el tooltip no nombra: eran dieciséis botones sin nombre
      // (WCAG 4.1.2), invisibles para axe. Ver vault: Navegacion.
      expect(row('design').textContent?.trim()).toBe('');
      expect(row('design').getAttribute('aria-label')).toBe('Sistema de diseño');

      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('and drops the label again when there is room for the text', async () => {
      // Expandido, el texto visible es el nombre: una copia en atributo derivaría al traducir.
      host.expanded.set(true);
      await settle();

      expect(row('design').getAttribute('aria-label')).toBeNull();
    });
  });

  it('asks for the other width, and does not change it by itself', async () => {
    const toggle = fixture.nativeElement.querySelector(
      '[data-nav-rail-toggle]',
    ) as HTMLButtonElement;
    toggle.click();
    await settle();

    expect(host.askedWidth).toBe(false);
    // El ancho es del consumidor.
    expect(host.expanded()).toBe(true);
  });

  it('has no axe violations, open group and all', async () => {
    host.activeId.set('clients');
    await settle();

    await expectNoAxeViolations(fixture.nativeElement);
  });
});
