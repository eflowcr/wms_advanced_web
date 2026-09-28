import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filtersInUrl, fromQueryParams, toQueryParams, type UrlFilterState } from './filters-in-url';

const KEYS = ['warehouse', 'date'];

describe('los filtros de pantalla en la URL', () => {
  it('escribe un texto tal cual y un período como `desde..hasta`, con un extremo o los dos', () => {
    expect(toQueryParams(KEYS, { warehouse: 'central' })).toEqual({
      warehouse: 'central',
      // La clave que se quitó viaja como null: así el router la borra de la URL.
      date: null,
    });
    expect(toQueryParams(KEYS, { date: { from: '2026-03-01', to: '2026-03-31' } })['date']).toBe(
      '2026-03-01..2026-03-31',
    );
    expect(toQueryParams(KEYS, { date: { from: '2026-03-01' } })['date']).toBe('2026-03-01..');
    expect(toQueryParams(KEYS, { date: { to: '2026-03-31' } })['date']).toBe('..2026-03-31');
  });

  it('lee solo las claves declaradas, y descarta lo vacío', () => {
    expect(
      fromQueryParams(KEYS, { warehouse: 'central', date: '..2026-03-31', page: '3', empty: '' }),
    ).toEqual({ warehouse: 'central', date: { to: '2026-03-31' } });
    expect(fromQueryParams(KEYS, { date: '..' })).toEqual({});
  });
});

@Component({ template: '' })
class ScreenComponent {
  readonly filters: UrlFilterState = filtersInUrl(KEYS);
}

describe('filtersInUrl', () => {
  it('LEE Y ESCRIBE LA URL: un enlace filtrado se comparte, y «atrás» deshace el último filtro', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'shipments', component: ScreenComponent }])],
    });
    const harness = await RouterTestingHarness.create('/shipments?warehouse=central');
    const screen = harness.routeDebugElement!.componentInstance as ScreenComponent;
    expect(screen.filters.value()).toEqual({ warehouse: 'central' });

    screen.filters.set({ warehouse: 'norte', date: { from: '2026-03-01' } });
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/shipments?warehouse=norte&date=2026-03-01..');
    expect(screen.filters.value()).toEqual({ warehouse: 'norte', date: { from: '2026-03-01' } });

    screen.filters.set({});
    await harness.fixture.whenStable();
    expect(router.url).toBe('/shipments');
    expect(screen.filters.value()).toEqual({});
  });
});
