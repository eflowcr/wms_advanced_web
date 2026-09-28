import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { deepestTitleKey } from './route-title-key';
import { RouteTitles } from './route-titles';

@Component({ selector: 'app-blank', template: '' })
class Blank {}

describe('RouteTitles', () => {
  it('knows a route only after it was visited, and ignores its query', () => {
    const titles = TestBed.inject(RouteTitles);
    expect(titles.keyFor('/design-system/components/button')).toBeNull();

    titles.record('/design-system/components/button?tab=api', 'showroom.catalog.button.name');

    expect(titles.keyFor('/design-system/components/button')).toBe('showroom.catalog.button.name');
    expect(titles.keyFor('/design-system/components/button?otra=1')).toBe(
      'showroom.catalog.button.name',
    );

    // Volver a la misma pantalla no reescribe nada; otra clave para la misma ruta, sí.
    titles.record('/design-system/components/button', 'showroom.catalog.button.name');
    titles.record('/design-system/components/button', 'shell.menu.designSystem');
    expect(titles.keyFor('/design-system/components/button')).toBe('shell.menu.designSystem');
  });

  it('takes the deepest title key: a child names the page better than its parent', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'catalogos',
            component: Blank,
            data: { titleKey: 'shell.menu.catalogs' },
            children: [
              { path: 'articulos', component: Blank, data: { titleKey: 'shell.menu.articles' } },
              { path: 'sin-titulo', component: Blank },
            ],
          },
        ]),
      ],
    });
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/catalogos/articulos');
    expect(deepestTitleKey(router.routerState.snapshot.root)).toBe('shell.menu.articles');

    // Sin clave propia, la del padre.
    await router.navigateByUrl('/catalogos/sin-titulo');
    expect(deepestTitleKey(router.routerState.snapshot.root)).toBe('shell.menu.catalogs');
  });
});
