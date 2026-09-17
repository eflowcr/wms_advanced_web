import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '@ewms/testing';
import { TranslocoService } from '@jsverse/transloco';

describe('IcuTranspiler', () => {
  let transloco: TranslocoService;

  beforeEach(async () => {
    // Startup never saves, so the language comes from the browser here.
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

  it('throws on a malformed message in development, naming the key', () => {
    expect(() => transloco.translate('broken', { count: 1 })).toThrow(
      /cannot format 'broken': .*no 'other' branch/,
    );
  });
});
