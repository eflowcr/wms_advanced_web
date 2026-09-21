import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { Breadcrumbs } from './breadcrumbs';
import type { Crumb } from './navigation.types';

const SHORT: readonly Crumb[] = [
  { label: 'Inicio', route: '/' },
  { label: 'Catálogos', route: '/catalogos' },
  { label: 'Artículos' },
];

/** El caso de la ficha: «Inicio / … / Ubicación A1-12-03». */
const DEEP: readonly Crumb[] = [
  { label: 'Inicio', route: '/' },
  { label: 'Almacenes', route: '/almacenes' },
  { label: 'CEDI', route: '/almacenes/cedi' },
  { label: 'Zona A', route: '/almacenes/cedi/a' },
  { label: 'Pasillo 1', route: '/almacenes/cedi/a/1' },
  { label: 'Rack 12', route: '/almacenes/cedi/a/1/12' },
  { label: 'Ubicación A1-12-03' },
];

@Component({
  template: `
    <ewms-breadcrumbs
      [items]="items()"
      label="Ruta de la página"
      [expandLabel]="expandLabel"
      (crumbSelect)="chosen = $event.label"
    />
  `,
  imports: [Breadcrumbs],
})
class TestHost {
  readonly items = signal(SHORT);
  readonly expandLabel = (hidden: number): string => `Mostrar ${hidden} niveles ocultos`;
  chosen: string | null = null;
}

describe('Breadcrumbs', () => {
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

  function steps(): HTMLElement[] {
    return [...fixture.nativeElement.querySelectorAll('li')];
  }

  function fold(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('[data-crumb-fold]');
  }

  it('is an ordered list inside a named nav: the order IS the meaning', () => {
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;

    expect(nav.getAttribute('aria-label')).toBe('Ruta de la página');
    expect(fixture.nativeElement.querySelector('ol')).not.toBeNull();
  });

  it('the last crumb is current and is NOT a link', () => {
    const current = fixture.nativeElement.querySelector('[aria-current="page"]') as HTMLElement;

    expect(current.textContent?.trim()).toBe('Artículos');
    // Un enlace a donde ya estás se anuncia como destino y no lleva a nada.
    expect(current.tagName).toBe('SPAN');
  });

  it('every other crumb reports itself when chosen', async () => {
    (fixture.nativeElement.querySelector('[data-crumb="Catálogos"]') as HTMLElement).click();
    await settle();

    expect(host.chosen).toBe('Catálogos');
  });

  it('the chevrons are decorative and say so', () => {
    const icons = [...fixture.nativeElement.querySelectorAll('ewms-icon svg')];

    expect(icons.length).toBeGreaterThan(0);
    expect(icons.every((icon) => (icon as SVGElement).getAttribute('aria-hidden') === 'true')).toBe(
      true,
    );
  });

  it('a short trail is not folded', () => {
    expect(fold()).toBeNull();
    expect(steps()).toHaveLength(3);
  });

  describe('a trail seven levels deep', () => {
    beforeEach(async () => {
      host.items.set(DEEP);
      await settle();
    });

    it('folds the middle, keeping the way out and where you are', () => {
      expect(steps()).toHaveLength(2);
      expect(fixture.nativeElement.textContent).toContain('Inicio');
      expect(fixture.nativeElement.textContent).toContain('Ubicación A1-12-03');
      expect(fixture.nativeElement.textContent).not.toContain('Zona A');
    });

    it('THE ELLIPSIS IS A BUTTON, and it says how much it is hiding', () => {
      // Tres puntos que no se pulsan no dejan volver a ver el camino.
      expect(fold()).not.toBeNull();
      expect(fold()?.getAttribute('aria-label')).toBe('Mostrar 5 niveles ocultos');
    });

    it('opening it gives the whole trail back', async () => {
      fold()?.click();
      await settle();

      expect(steps()).toHaveLength(7);
      expect(fold()).toBeNull();
    });

    it('has no axe violations, folded or open', async () => {
      await expectNoAxeViolations(fixture.nativeElement);

      fold()?.click();
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    });
  });

  it('an empty trail renders nothing and throws nothing', async () => {
    host.items.set([]);
    await settle();

    expect(steps()).toHaveLength(0);
  });
});
