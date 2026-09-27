import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '@ewms/testing';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { IcuTranspiler } from './icu.transpiler';

describe('IcuTranspiler', () => {
  let transloco: TranslocoService;

  beforeEach(async () => {
    // El arranque no guarda nada: acá el idioma sale del navegador.
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('es-CR');
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting({
          es: {
            located: '{count, plural, one {# bulto en {{ location }}} other {# bultos en {{ location }}}}',
            broken: '{count, plural, one {# bulto}}',
            plain: 'Ubicación {{ location }}',
          },
          en: {},
        }),
      ],
    });
    transloco = TestBed.inject(TranslocoService);
    await TestBed.inject(ApplicationInitStatus).donePromise;
  });

  afterEach(() => vi.restoreAllMocks());

  it('runs ICU on the dictionary text and interpolates parameters afterwards', () => {
    expect(transloco.translate('located', { count: 2, location: 'A-01' })).toBe('2 bultos en A-01');
  });

  it('never parses a parameter value as ICU', () => {
    expect(transloco.translate('located', { count: 1, location: 'A{1}, plural' })).toBe(
      '1 bulto en A{1}, plural',
    );
    expect(transloco.translate('plain', { location: '{x, select, other {boom}}' })).toBe(
      'Ubicación {x, select, other {boom}}',
    );
  });

  it('formats # in the locale of the language that loaded, also through a scope', () => {
    const transpiler = TestBed.inject(TRANSLOCO_TRANSPILER) as IcuTranspiler;
    const units = '{count, plural, one {# bulto} other {# bultos}}';
    const format = (): unknown =>
      transpiler.transpile({
        value: units,
        params: { count: 1234 },
        translation: {},
        key: 'units',
      });

    // Las cargas con scope llegan como 'scope/idioma': el locale sigue al idioma.
    transpiler.onLangChanged('showroom/en');
    expect(format()).toBe(`${new Intl.NumberFormat('en-US').format(1234)} bultos`);

    // Un idioma que no es de la aplicación cae al de por defecto, nunca al del sistema.
    transpiler.onLangChanged('fr');
    expect(format()).toBe(`${new Intl.NumberFormat('es-CR').format(1234)} bultos`);
  });

  it('formats a message it already parsed with the parameters of each call', () => {
    expect(transloco.translate('located', { count: 1, location: 'A-01' })).toBe('1 bulto en A-01');
    expect(transloco.translate('located', { count: 3, location: 'B-02' })).toBe('3 bultos en B-02');
  });

  it('throws on a malformed message in development, naming the key', () => {
    expect(() => transloco.translate('broken', { count: 1 })).toThrow(
      /cannot format 'broken': .*no 'other' branch/,
    );
  });
});
