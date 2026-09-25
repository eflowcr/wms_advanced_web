import { ApplicationInitStatus } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LanguageService, type Language } from '@ewms/core';
import { ToastService } from '@ewms/design-system';
import { expectNoAxeViolations, provideI18nTesting } from '@ewms/testing';
import { DICTIONARIES } from '../i18n.testing';
import { LanguageSwitcher } from './language-switcher';

async function render(
  browser: string,
  dictionaries: Partial<typeof DICTIONARIES> = DICTIONARIES,
): Promise<ComponentFixture<LanguageSwitcher>> {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(browser);
  // Nada se guarda: la preferencia de una prueba decidiría el idioma de la siguiente.
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
  await TestBed.configureTestingModule({
    imports: [LanguageSwitcher],
    providers: [provideI18nTesting(dictionaries)],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;
  const fixture = TestBed.createComponent(LanguageSwitcher);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  return fixture;
}

/** El campo del `ewms-select`: muestra el nombre del idioma elegido, escrito en ese idioma. */
function control(fixture: ComponentFixture<LanguageSwitcher>): HTMLInputElement {
  return (fixture.nativeElement as HTMLElement).querySelector(
    '[role="combobox"]',
  ) as HTMLInputElement;
}

/** Lo que hace una persona: abre el campo y elige la opción. */
async function choose(fixture: ComponentFixture<LanguageSwitcher>, value: Language): Promise<void> {
  control(fixture).click();
  await fixture.whenStable();
  document.querySelector<HTMLElement>(`[role="option"][lang="${value}"]`)?.click();
  // El cambio es asíncrono (carga el diccionario) y la estabilidad no lo espera.
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

/** El aviso del caso A es un Toast: lo que muestra la cola compartida. */
function notices(): readonly string[] {
  return TestBed.inject(ToastService)
    .toasts()
    .map(({ message }) => message);
}

describe('LanguageSwitcher', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document
      .querySelectorAll('app-language-switcher, .cdk-overlay-container')
      .forEach((node) => node.remove());
  });

  it('shows the language startup resolved, not just the first option', async () => {
    const fixture = await render('en-US');

    expect(control(fixture).value).toBe('English');
    expect(control(fixture).getAttribute('lang')).toBe('en');
  });

  it('follows a change of language made outside the control', async () => {
    const fixture = await render('es-CR');

    await TestBed.inject(LanguageService).use('en');
    await fixture.whenStable();

    expect(control(fixture).value).toBe('English');
  });

  it('switches language from the control', async () => {
    const fixture = await render('es-CR');

    await choose(fixture, 'en');

    expect(TestBed.inject(LanguageService).active()).toBe('en');
    expect(control(fixture).value).toBe('English');
  });

  it('writes every language in its own, with its lang, under a hidden label', async () => {
    const fixture = await render('es-CR');

    control(fixture).click();
    await fixture.whenStable();

    const options = [...document.querySelectorAll('[role="option"]')];
    expect(
      options.map((option) => [option.textContent?.trim(), option.getAttribute('lang')]),
    ).toEqual([
      ['Español', 'es'],
      ['English', 'en'],
    ]);
    const label = (fixture.nativeElement as HTMLElement).querySelector(
      `label[for="${control(fixture).id}"]`,
    );
    expect(label?.textContent?.trim()).toBe(DICTIONARIES.es.shell.languageSwitcher.label);
    expect(label?.classList.contains('sr-only')).toBe(true);
  });

  it('case A: goes back to the language on screen and tells the user when the dictionary fails', async () => {
    const fixture = await render('es-CR', { es: DICTIONARIES.es });

    await choose(fixture, 'en');

    expect(control(fixture).value).toBe('Español');
    expect(notices()).toEqual([DICTIONARIES.es.shell.languageSwitcher.unavailable]);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);

    // Un cambio que sale bien se lleva el aviso.
    await TestBed.inject(LanguageService).use('es');
    await fixture.whenStable();
    expect(notices()).toEqual([]);
  });

  it('shows no notice while every dictionary loads', async () => {
    const fixture = await render('es-CR');

    await choose(fixture, 'en');

    expect(notices()).toEqual([]);
  });
});
