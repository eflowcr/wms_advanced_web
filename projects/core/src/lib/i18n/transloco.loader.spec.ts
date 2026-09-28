import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DICTIONARY_VERSIONS, HttpTranslocoLoader } from './transloco.loader';

describe('HttpTranslocoLoader', () => {
  function loaderWith(versions?: Readonly<Record<string, string>>) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HttpTranslocoLoader,
        ...(versions ? [{ provide: DICTIONARY_VERSIONS, useValue: versions }] : []),
      ],
    });
    return {
      loader: TestBed.inject(HttpTranslocoLoader),
      backend: TestBed.inject(HttpTestingController),
    };
  }

  it('asks for a dictionary with its fingerprint: new content, new URL', () => {
    const { loader, backend } = loaderWith({ es: 'abc1234567', 'showroom/en': 'def7654321' });

    loader.getTranslation('es').subscribe();
    loader.getTranslation('showroom/en').subscribe();

    backend.expectOne('i18n/es.json?v=abc1234567');
    backend.expectOne('i18n/showroom/en.json?v=def7654321');
    backend.verify();
  });

  it('a dictionary the table does not know is asked for plain', () => {
    const { loader, backend } = loaderWith();

    loader.getTranslation('es').subscribe();

    backend.expectOne('i18n/es.json');
    backend.verify();
  });
});
