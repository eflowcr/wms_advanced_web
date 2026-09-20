import { Injector, signal } from '@angular/core';
import { EWMS_FAVORITE_LABELS, type FavoriteLabelResolver } from '@ewms/design-system';
import {
  provideShowroomDesignSystem,
  SEARCH_SELECT_MESSAGES,
  TABLE_FORMATTERS,
  TABLE_MESSAGES,
} from './showroom.providers';

/**
 * The catalogue's own dictionaries.
 *
 * They are tested because they are the showroom's proof that the token pattern
 * works twice: the shell fills the same interfaces out of `core/i18n`, and
 * this file fills them with `Intl` and literals. If the interface only ever
 * had one implementation, it would not be an interface -- it would be an
 * indirection.
 */
describe('the showroom dictionaries', () => {
  describe('formatters', () => {
    it('turns a number into text, and takes a numeric string too', () => {
      /*
       * WHAT THE SEPARATOR LOOKS LIKE IS NOT ASSERTED HERE, on purpose. Node
       * is built with a trimmed ICU in this environment, so `Intl` falls back
       * to the root locale and `1200` comes out without a separator -- which
       * says something about the test runner and nothing about the code. The
       * grouping a person actually sees is a browser fact, and the browser is
       * where e2e checks it.
       */
      expect(TABLE_FORMATTERS.number(1200)).toContain('1');
      expect(TABLE_FORMATTERS.number(1200)).toContain('200');
      expect(TABLE_FORMATTERS.number('900')).toContain('900');
    });

    it('formats an ISO date', () => {
      expect(TABLE_FORMATTERS.date('2026-01-15')).toContain('2026');
    });

    it('RETURNS THE RAW VALUE RATHER THAN "Invalid Date"', () => {
      // A table shows whatever the source handed over, and a source may hold a
      // value in a shape nobody expected. Printing the raw text is
      // information; printing "Invalid Date" is the table blaming the data.
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

    it('says how many results, with or without a total', () => {
      // `null` is a legitimate total, and the message is where that shows.
      expect(SEARCH_SELECT_MESSAGES.results(3, 340)).toBe('3 de 340 resultados');
      expect(SEARCH_SELECT_MESSAGES.results(3, null)).toBe('3 resultados');
    });

    it('repeats the text that was searched', () => {
      expect(SEARCH_SELECT_MESSAGES.noResults('caja')).toContain('caja');
    });
  });
});

/**
 * What a favourite is called in the catalogue's sidebar (REQ-FE-DS4-002 v1.3).
 *
 * Two injectors, because that is the shape in the application: the shell's
 * resolver above, the catalogue's below it, asking upwards for what it does not
 * know.
 */
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
    // The catalogue has no icons of its own: the block draws its neutral one.
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
