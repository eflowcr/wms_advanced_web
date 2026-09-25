import { ApplicationInitStatus, computed, type InjectionToken } from '@angular/core';
import { LanguageService } from '@ewms/core';
import { TestBed } from '@angular/core/testing';
import * as designSystem from '@ewms/design-system';
import {
  EWMS_FAVORITE_LABELS,
  EWMS_FILTER_CHIPS_MESSAGES,
  EWMS_FORM_MESSAGES,
  EWMS_PAGINATION_MESSAGES,
  EWMS_SELECT_MESSAGES,
  EWMS_TABLE_FORMATTERS,
  EWMS_TABLE_MESSAGES,
} from '@ewms/design-system';
import { provideI18nTesting } from '@ewms/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideEwmsDesignSystem } from './design-system.providers';
import { WITH_SHOWROOM } from './i18n.testing';

/**
 * Todos los tokens de textos del design system, leídos de su API pública: uno nuevo entra solo, y
 * si el shell no lo provee, `inject` lanza. Sin esto caía en su `NO_*_MESSAGES`, mudo, sin aviso.
 */
const MESSAGE_TOKENS = Object.entries(designSystem).filter(([name]) =>
  /^EWMS_[A-Z_]+_MESSAGES$/.test(name),
) as [string, InjectionToken<unknown>][];

/** Argumentos que tienen sentido para una función de mensajes; el resto recibe números. */
const SAMPLE_ARGUMENTS: Readonly<Record<string, readonly unknown[]>> = {
  aggregate: ['sum', 'Bultos', 'shown'],
  minDate: [new Date(2026, 2, 16)],
  maxDate: [new Date(2026, 2, 16)],
};

/** Las rutas de los textos vacíos de un objeto de mensajes: cadenas, funciones y anidados. */
function emptyTexts(value: unknown, path: string): string[] {
  if (typeof value === 'string') {
    return value.trim() === '' ? [path] : [];
  }
  if (typeof value === 'function') {
    const name = path.split('.').pop() ?? '';
    return emptyTexts(
      (value as (...args: unknown[]) => unknown)(...(SAMPLE_ARGUMENTS[name] ?? [2, 3, 4])),
      path,
    );
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).flatMap((key) =>
      emptyTexts((value as Record<string, unknown>)[key], `${path}.${key}`),
    );
  }
  return [`${path} (${String(value)})`];
}

async function start(browser: string): Promise<void> {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(browser);
  // Nada se guarda: un cambio de idioma de una prueba decidiría el de la siguiente.
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
  TestBed.configureTestingModule({
    providers: [provideI18nTesting(WITH_SHOWROOM), provideEwmsDesignSystem()],
  });
  await TestBed.inject(ApplicationInitStatus).donePromise;
}

describe('the design-system texts the shell provides', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads every message token from the public API', () => {
    expect(MESSAGE_TOKENS.map(([name]) => name)).toEqual(
      expect.arrayContaining(['EWMS_TABLE_MESSAGES', 'EWMS_SELECT_MESSAGES', 'EWMS_FORM_MESSAGES']),
    );
    expect(MESSAGE_TOKENS.length).toBeGreaterThanOrEqual(9);
  });

  for (const [language, browser] of [
    ['es', 'es-CR'],
    ['en', 'en-US'],
  ] as const) {
    it(`fills every EWMS_*_MESSAGES token with text in ${language}: none stays silent`, async () => {
      await start(browser);
      for (const [name, token] of MESSAGE_TOKENS) {
        expect(emptyTexts(TestBed.inject(token), name), name).toEqual([]);
      }
    });
  }

  it('follows a change of language where a component copies the messages, as the table does', async () => {
    await start('es-CR');
    // Un componente OnPush guarda sus textos en un computed que copia el objeto (los getters se leen
    // al copiar): tiene que recalcularse solo, o la barra queda en el idioma anterior.
    const table = TestBed.inject(EWMS_TABLE_MESSAGES);
    const text = computed(() => ({ ...table }));
    const format = TestBed.inject(EWMS_TABLE_FORMATTERS);
    const day = computed(() => format.date('2026-03-16'));
    expect(text().view).toBe('Vista');

    await TestBed.inject(LanguageService).use('en');

    expect(text().view).toBe('View');
    expect(text().filters(2)).toBe('Filters (2)');
    expect(day()).toBe('03/16/2026');
  });

  it('words counts, filters and the status bar in Spanish', async () => {
    await start('es-CR');
    const table = TestBed.inject(EWMS_TABLE_MESSAGES);
    const pagination = TestBed.inject(EWMS_PAGINATION_MESSAGES);
    const select = TestBed.inject(EWMS_SELECT_MESSAGES);

    expect(pagination.pageOf(2, 5)).toBe('Página 2 de 5');
    expect(pagination.rowsTotal(1)).toBe('1 fila');
    expect(pagination.rowsTotal(12)).toBe('12 filas');
    expect(table.filters(0)).toBe('Filtros');
    expect(table.filters(2)).toBe('Filtros (2)');
    expect(TestBed.inject(EWMS_FILTER_CHIPS_MESSAGES).removeFilter('Estado')).toBe(
      'Quitar el filtro Estado',
    );
    expect(table.setSummary('Estado', 4, 4)).toBe('Estado: todos');
    expect(table.setSummary('Estado', 2, 4)).toBe('Estado: 2 de 4');
    expect(table.setSummary('Estado', 0, 4)).toBe('Estado: ninguno');
    expect(table.rowsShown(12, 340)).toBe('12 de 340 filas');
    expect(table.rowsShown(12, null)).toBe('12 filas');
    expect(table.selectedCount(1)).toBe('1 seleccionada');
    expect(table.selectedCount(3)).toBe('3 seleccionadas');
    expect(table.copied(1)).toBe('1 fila copiada');
    expect(table.copied(4)).toBe('4 filas copiadas');
    expect(table.aggregate('sum', 'Bultos', 'selected')).toBe('Bultos seleccionados');
    expect(table.aggregate('avg', 'Bultos', 'shown')).toBe('Promedio de Bultos en pantalla');
    expect(table.aggregate('count', 'Bultos', 'shown')).toBe('Filas con Bultos en pantalla');
    // `null` es un total legítimo y el mensaje lo refleja.
    expect(select.results(3, 340)).toBe('3 de 340 resultados');
    expect(select.results(3, null)).toBe('3 resultados');
    expect(select.noResults('caja')).toContain('caja');
  });

  it('writes one form message per kind, with the limit the validator set', async () => {
    await start('es-CR');
    const form = TestBed.inject(EWMS_FORM_MESSAGES);
    const write = form.errors;

    expect(write.required(null)).toBe('Este campo es obligatorio');
    expect(write.minLength(3)).toBe('Mínimo 3 caracteres');
    expect(write.maxLength(8)).toBe('Máximo 8 caracteres');
    expect(write.min(1)).toBe('El mínimo es 1');
    expect(write.max(999)).toBe('El máximo es 999');
    expect(write.minDate(new Date(2026, 2, 16))).toBe('La fecha mínima es 16/03/2026');
    expect(write.maxDate(new Date(2026, 2, 16))).toBe('La fecha máxima es 16/03/2026');
    expect(write.pattern(null)).toBe('El formato no es el esperado');
    expect(write.email(null)).toBe('Escribí un correo válido');
    expect(form.customError(null)).toBe('Revisá este campo');
    expect(form.errorSummary(1)).toBe('Revisá 1 campo');
    expect(form.errorSummary(3)).toBe('Revisá 3 campos');
    // Un límite que no es fecha no se escribe como «Invalid Date».
    expect(write.minDate('mañana')).toBe('La fecha mínima es ');
  });

  describe('the favourite labels', () => {
    it('names a screen by its menu entry, with or without a query string', async () => {
      await start('es-CR');
      const labels = TestBed.inject(EWMS_FAVORITE_LABELS);

      expect(labels.labelFor('/catalogos/articulos')()).toBe('Artículos');
      expect(labels.labelFor('/catalogos/articulos?estado=1')()).toBe('Artículos');
      expect(labels.labelFor('/')()).toBe('Dashboard');
      expect(labels.labelFor('/?pestaña=2')()).toBe('Dashboard');
      expect(labels.iconFor('/catalogos/articulos')).not.toBeNull();
      // Una ruta que no es del menú no resuelve: el bloque muestra la ruta.
      expect(labels.labelFor('/no-existe')()).toBe('');
      expect(labels.iconFor('/no-existe')).toBeNull();
    });

    it('names a catalogue page as its catalogue does, and follows a change of language', async () => {
      await start('es-CR');
      // El catálogo carga su diccionario al abrirse; un favorito suyo existe solo después.
      await firstValueFrom(TestBed.inject(TranslocoService).load('showroom/es'));
      const label = TestBed.inject(EWMS_FAVORITE_LABELS).labelFor(
        '/design-system/components/button',
      );
      expect(label()).toBe('Botón');

      // LanguageService trae el scope ya cargado junto con el idioma: nada queda a medio traducir.
      await TestBed.inject(LanguageService).use('en');

      expect(label()).toBe('Button');
    });
  });

  describe('the table formatters', () => {
    it('turns a number into text, and takes a numeric string too', async () => {
      await start('es-CR');
      const format = TestBed.inject(EWMS_TABLE_FORMATTERS);
      // El separador no se afirma: el ICU de Node puede venir recortado. La agrupación visible la
      // verifica e2e en el navegador.
      expect(format.number(1200)).toContain('1');
      expect(format.number(1200)).toContain('200');
      expect(format.number('900')).toContain('900');
    });

    it('formats an ISO date with two-digit day and month, so a column reads aligned', async () => {
      await start('es-CR');
      expect(TestBed.inject(EWMS_TABLE_FORMATTERS).date('2026-01-05')).toMatch(
        /^\d{2}\/\d{2}\/2026$/,
      );
    });

    it('RETURNS THE RAW VALUE RATHER THAN "Invalid Date"', async () => {
      await start('es-CR');
      const format = TestBed.inject(EWMS_TABLE_FORMATTERS);
      // La fuente puede traer formas inesperadas: el texto crudo es información;
      // «Invalid Date» es la tabla culpando al dato.
      expect(format.date('mañana')).toBe('mañana');
      expect(format.number('no es un número')).toBe('no es un número');
    });

    it('shows nothing for nothing, rather than a zero or the word null', async () => {
      await start('es-CR');
      const format = TestBed.inject(EWMS_TABLE_FORMATTERS);
      for (const empty of [null, undefined, '']) {
        expect(format.date(empty)).toBe('');
        expect(format.number(empty)).toBe('');
      }
    });
  });
});
