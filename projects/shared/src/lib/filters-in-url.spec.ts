import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filtersInUrl, fromQueryParams, toQueryParams, type UrlFilterState } from './filters-in-url';

const KEYS = ['almacen', 'fecha'];

describe('los filtros de pantalla en la URL', () => {
  it('escribe un texto tal cual y un período como `desde..hasta`, con un extremo o los dos', () => {
    expect(toQueryParams(KEYS, { almacen: 'central' })).toEqual({
      almacen: 'central',
      // La clave que se quitó viaja como null: así el router la borra de la URL.
      fecha: null,
    });
    expect(toQueryParams(KEYS, { fecha: { from: '2026-03-01', to: '2026-03-31' } })['fecha']).toBe(
      '2026-03-01..2026-03-31',
    );
    expect(toQueryParams(KEYS, { fecha: { from: '2026-03-01' } })['fecha']).toBe('2026-03-01..');
    expect(toQueryParams(KEYS, { fecha: { to: '2026-03-31' } })['fecha']).toBe('..2026-03-31');
  });

  it('lee solo las claves declaradas, y descarta lo vacío', () => {
    expect(
      fromQueryParams(KEYS, { almacen: 'central', fecha: '..2026-03-31', pagina: '3', vacio: '' }),
    ).toEqual({ almacen: 'central', fecha: { to: '2026-03-31' } });
    expect(fromQueryParams(KEYS, { fecha: '..' })).toEqual({});
  });
});

@Component({ template: '' })
class ScreenComponent {
  readonly filters: UrlFilterState = filtersInUrl(KEYS);
}

describe('filtersInUrl', () => {
  it('LEE Y ESCRIBE LA URL: un enlace filtrado se comparte, y «atrás» deshace el último filtro', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'expediciones', component: ScreenComponent }])],
    });
    const harness = await RouterTestingHarness.create('/expediciones?almacen=central');
    const screen = harness.routeDebugElement!.componentInstance as ScreenComponent;
    expect(screen.filters.value()).toEqual({ almacen: 'central' });

    screen.filters.set({ almacen: 'norte', fecha: { from: '2026-03-01' } });
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/expediciones?almacen=norte&fecha=2026-03-01..');
    expect(screen.filters.value()).toEqual({ almacen: 'norte', fecha: { from: '2026-03-01' } });

    screen.filters.set({});
    await harness.fixture.whenStable();
    expect(router.url).toBe('/expediciones');
    expect(screen.filters.value()).toEqual({});
  });
});
