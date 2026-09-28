import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { NavBottom } from './nav-bottom';
import type { NavItem } from './navigation.types';

/** La forma real del menú: cuatro en primer nivel, doce en segundo. */
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
  {
    id: 'settings',
    label: 'Configuración',
    icon: 'settings',
    children: [{ id: 'users', label: 'Usuarios', icon: 'operator', route: '/usuarios' }],
  },
  { id: 'design', label: 'Sistema de diseño', icon: 'controls', route: '/design-system' },
];

@Component({
  template: `
    <ewms-nav-bottom
      [items]="items()"
      label="Navegación principal"
      moreLabel="Más"
      closeLabel="Cerrar el menú"
      [activeId]="activeId()"
      (itemSelect)="chosen = $event.id"
    >
      <p navBottomTop data-top>favoritos</p>
      <p navBottomFooter data-foot>v0.0.0 · Operador</p>
    </ewms-nav-bottom>
  `,
  imports: [NavBottom],
})
class TestHost {
  readonly items = signal(TREE);
  readonly activeId = signal<string | null>('dashboard');
  chosen: string | null = null;
}

describe('NavBottom', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  // Dibuja la hoja y después corre la trampa: `afterNextRender` más la macrotarea propia de
  // `focusFirstTabbableElementWhenReady`.
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  }

  function barItems(): HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll('[data-nav-bottom-item]')];
  }

  function more(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-nav-bottom-more]') as HTMLButtonElement;
  }

  function sheet(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-nav-bottom-sheet]');
  }

  it('the bar carries DESTINATIONS only: a group on it would be «Más» with another name', () => {
    expect(barItems().map((element) => element.dataset['navBottomItem'])).toEqual([
      'dashboard',
      'design',
    ]);
  });

  it('and offers «Más» for everything the bar could not take', () => {
    expect(more()).not.toBeNull();
    expect(more().getAttribute('aria-expanded')).toBe('false');
  });

  it('marks the destination you are on', () => {
    expect(barItems()[0]?.getAttribute('aria-current')).toBe('page');
  });

  it('a destination on the bar reports itself in ONE tap', async () => {
    barItems()[1]?.click();
    await settle();

    expect(host.chosen).toBe('design');
  });

  describe('the sheet', () => {
    beforeEach(async () => {
      more().click();
      await settle();
    });

    it('holds the whole tree, groups expanded', () => {
      expect(sheet()).not.toBeNull();
      const entries = [...fixture.nativeElement.querySelectorAll('[data-nav-sheet-item]')];
      expect(entries.map((element) => (element as HTMLElement).dataset['navSheetItem'])).toEqual([
        'dashboard',
        'articles',
        'clients',
        'users',
        'design',
      ]);
    });

    it('THE COST OF THE BOTTOM BAR, ASSERTED: a second-level screen takes TWO taps', async () => {
      // En el rail «Artículos» es un clic; acá «Más» y la entrada. Es el precio de la barra
      // inferior (decisión del usuario, 2026-09-19), escrito como prueba.
      const articles = fixture.nativeElement.querySelector(
        '[data-nav-sheet-item="articles"]',
      ) as HTMLElement;
      articles.click();
      await settle();

      expect(host.chosen).toBe('articles');
    });

    it('projects the favourites block: the fixed place survives the narrow layout', () => {
      expect(fixture.nativeElement.querySelector('[data-top]')).not.toBeNull();
    });

    it('projects the consumer footer LAST, below the close control', () => {
      const foot = fixture.nativeElement.querySelector('[data-foot]') as HTMLElement;
      expect(foot.parentElement).toBe(sheet());
      expect(sheet()?.lastElementChild).toBe(foot);
    });

    it('closes behind you when you choose something', async () => {
      (
        fixture.nativeElement.querySelector('[data-nav-sheet-item="users"]') as HTMLElement
      ).click();
      await settle();

      expect(sheet()).toBeNull();
    });

    it('a GROUP heading in the sheet is not a control: it opens nothing', () => {
      // Todo grupo ya está expandido: un grupo pulsable no tendría nada que hacer.
      expect(fixture.nativeElement.querySelector('[data-nav-sheet-item="catalogs"]')).toBeNull();
    });

    it('IS TRAPPED, and the trap really was built around THIS element', () => {
      // La primera versión armaba la trampa en un microtask, antes del `@if`: no había trampa.
      // Se afirman las anclas del CDK, no `document.activeElement` (jsdom adivina visibilidad);
      // dónde cae el foco lo prueba `e2e/smoke.e2e.ts`.
      const anchors = sheet()?.parentElement?.querySelectorAll('.cdk-focus-trap-anchor');

      expect(anchors?.length).toBe(2);
    });

    it('Escape closes it AND GIVES THE FOCUS BACK to what opened it', async () => {
      sheet()?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      await settle();

      expect(sheet()).toBeNull();
      // Soltar el foco en el body obliga a tabular toda la página para volver.
      expect(document.activeElement).toBe(more());
    });

    it('the close control closes it too, by the same path', async () => {
      (fixture.nativeElement.querySelector('[data-nav-bottom-close]') as HTMLElement).click();
      await settle();

      expect(sheet()).toBeNull();
      expect(document.activeElement).toBe(more());
    });

    it('the backdrop closes it, and is invisible to a screen reader', async () => {
      const backdrop = fixture.nativeElement.querySelector(
        '[data-nav-bottom-backdrop]',
      ) as HTMLElement;
      expect(backdrop.getAttribute('aria-hidden')).toBe('true');

      backdrop.click();
      await settle();
      expect(sheet()).toBeNull();
    });

    it('a key that is not Escape is left alone', async () => {
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      sheet()?.dispatchEvent(event);
      await settle();

      expect(event.defaultPrevented).toBe(false);
      expect(sheet()).not.toBeNull();
    });

    it('has no axe violations while open', async () => {
      await expectNoAxeViolations(fixture.nativeElement);
    });
  });

  it('with nothing left over there is no «Más» at all', async () => {
    host.items.set([{ id: 'only', label: 'Solo', icon: 'home', route: '/' }]);
    await settle();

    expect(more()).toBeNull();
  });

  it('has no axe violations closed', async () => {
    await expectNoAxeViolations(fixture.nativeElement);
  });
});
