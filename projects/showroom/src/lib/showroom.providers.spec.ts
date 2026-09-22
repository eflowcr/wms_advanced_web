import { Injector, signal } from '@angular/core';
import { EWMS_FAVORITE_LABELS, type FavoriteLabelResolver } from '@ewms/design-system';
import {
  provideShowroomDesignSystem,
  SELECT_MESSAGES,
  TABLE_FORMATTERS,
  TABLE_MESSAGES,
} from './showroom.providers';

// Los diccionarios del catálogo prueban que el patrón de tokens funciona dos veces: el shell
// llena las mismas interfaces desde `core/i18n` y acá con `Intl` y literales.
describe('the showroom dictionaries', () => {
  describe('formatters', () => {
    it('turns a number into text, and takes a numeric string too', () => {
      // El separador no se afirma: este Node trae ICU recortado y `Intl` cae al locale raíz
      // (`1200` sin separador). La agrupación visible la verifica e2e en el navegador.
      expect(TABLE_FORMATTERS.number(1200)).toContain('1');
      expect(TABLE_FORMATTERS.number(1200)).toContain('200');
      expect(TABLE_FORMATTERS.number('900')).toContain('900');
    });

    it('formats an ISO date', () => {
      expect(TABLE_FORMATTERS.date('2026-01-15')).toContain('2026');
    });

    it('RETURNS THE RAW VALUE RATHER THAN "Invalid Date"', () => {
      // La fuente puede traer formas inesperadas: el texto crudo es información;
      // «Invalid Date» es la tabla culpando al dato.
      expect(TABLE_FORMATTERS.date('mañana')).toBe('mañana');
      expect(TABLE_FORMATTERS.number('no es un número')).toBe('no es un número');
    });

    it('shows nothing for nothing, rather than a zero or the word null', () => {
      for (const empty of [null, undefined, '']) {
        expect(TABLE_FORMATTERS.date(empty)).toBe('');
        expect(TABLE_FORMATTERS.number(empty)).toBe('');
      }
    });
  });

  describe('messages', () => {
    it('counts pages and rows in words', () => {
      expect(TABLE_MESSAGES.pageOf(2, 5)).toBe('Página 2 de 5');
      expect(TABLE_MESSAGES.rowsTotal(1)).toBe('1 fila');
      expect(TABLE_MESSAGES.rowsTotal(12)).toBe('12 filas');
    });

    it('says what the toolbar filters, and how much of a set is chosen', () => {
      expect(TABLE_MESSAGES.filters(0)).toBe('Filtros');
      expect(TABLE_MESSAGES.filters(2)).toBe('Filtros (2)');
      expect(TABLE_MESSAGES.removeFilter('Estado')).toBe('Quitar el filtro Estado');
      expect(TABLE_MESSAGES.setSummary('Estado', 4, 4)).toBe('Estado: todos');
      expect(TABLE_MESSAGES.setSummary('Estado', 2, 4)).toBe('Estado: 2 de 4');
      expect(TABLE_MESSAGES.setSummary('Estado', 0, 4)).toBe('Estado: ninguno');
    });

    it('words the status bar: rows, selection, copies and each kind of aggregate', () => {
      expect(TABLE_MESSAGES.rowsShown(12, 340)).toBe('12 de 340 filas');
      expect(TABLE_MESSAGES.rowsShown(12, null)).toBe('12 filas');
      expect(TABLE_MESSAGES.selectedCount(1)).toBe('1 seleccionada');
      expect(TABLE_MESSAGES.selectedCount(3)).toBe('3 seleccionadas');
      expect(TABLE_MESSAGES.copied(1)).toBe('1 fila copiada');
      expect(TABLE_MESSAGES.copied(4)).toBe('4 filas copiadas');
      expect(TABLE_MESSAGES.aggregate('sum', 'Bultos', 'selected')).toBe('Bultos seleccionados');
      expect(TABLE_MESSAGES.aggregate('avg', 'Bultos', 'shown')).toBe('Promedio de bultos en pantalla');
      expect(TABLE_MESSAGES.aggregate('count', 'Bultos', 'shown')).toBe('Filas con bultos en pantalla');
    });

    it('says how many results, with or without a total', () => {
      // `null` es un total legítimo y el mensaje lo refleja.
      expect(SELECT_MESSAGES.results(3, 340)).toBe('3 de 340 resultados');
      expect(SELECT_MESSAGES.results(3, null)).toBe('3 resultados');
    });

    it('repeats the text that was searched', () => {
      expect(SELECT_MESSAGES.noResults('caja')).toContain('caja');
    });
  });
});

// Nombre de un favorito en la barra del catálogo (REQ-FE-DS4-002 v1.3). Dos inyectores, como en
// la aplicación: el resolvedor del shell arriba y el del catálogo abajo, preguntando hacia arriba.
describe("the showroom's favourite labels", () => {
  const BUTTON = '/design-system/components/button';

  function resolverUnder(parent?: FavoriteLabelResolver): FavoriteLabelResolver {
    const above = Injector.create({
      providers: parent === undefined ? [] : [{ provide: EWMS_FAVORITE_LABELS, useValue: parent }],
    });
    return Injector.create({ providers: provideShowroomDesignSystem(), parent: above }).get(
      EWMS_FAVORITE_LABELS,
    );
  }

  const application: FavoriteLabelResolver = {
    labelFor: (route) => signal(route === '/catalogos/articulos' ? 'Artículos' : '').asReadonly(),
    iconFor: (route) => (route === '/catalogos/articulos' ? 'package' : null),
  };

  it('names a catalogue page by its entry, whatever is above', () => {
    expect(resolverUnder().labelFor(BUTTON)()).toBe('Botón');
    expect(resolverUnder(application).labelFor(BUTTON)()).toBe('Botón');
    // El catálogo no tiene íconos propios: el bloque dibuja el neutro.
    expect(resolverUnder(application).iconFor(BUTTON)).toBeNull();
  });

  it("asks the application for a screen that is not the catalogue's", () => {
    const labels = resolverUnder(application);
    expect(labels.labelFor('/catalogos/articulos')()).toBe('Artículos');
    expect(labels.iconFor('/catalogos/articulos')).toBe('package');
  });

  it('alone, an unknown route resolves to nothing -- and the block shows the route', () => {
    const labels = resolverUnder();
    expect(labels.labelFor('/no-existe')()).toBe('');
    expect(labels.iconFor('/no-existe')).toBeNull();
  });
});
