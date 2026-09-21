import { ApplicationInitStatus } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LanguageService, type Language } from '@ewms/core';
import { expectNoAxeViolations, provideI18nTesting } from '@ewms/testing';
import { DICTIONARIES } from '../i18n.testing';
import { LanguageSwitcher } from './language-switcher';

async function render(
  browser: string,
  dictionaries: Partial<typeof DICTIONARIES> = DICTIONARIES,
): Promise<ComponentFixture<LanguageSwitcher>> {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(browser);
  await TestBed.configureTestingModule({
    imports: [LanguageSwitcher],
    providers: [provideI18nTesting(dictionaries)],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;
  const fixture = TestBed.createComponent(LanguageSwitcher);
  await fixture.whenStable();
  return fixture;
}

function control(fixture: ComponentFixture<LanguageSwitcher>): HTMLSelectElement {
  return (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
}

/** Lo que hace una persona: elige una opción en el control nativo. */
async function choose(fixture: ComponentFixture<LanguageSwitcher>, value: Language): Promise<void> {
  const select = control(fixture);
  select.value = value;
  select.dispatchEvent(new Event('change'));
  await fixture.whenStable();
}

describe('LanguageSwitcher', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the language startup resolved, not just the first option', async () => {
    const fixture = await render('en-US');

    expect(control(fixture).value).toBe('en');
  });

  it('follows a change of language made outside the control', async () => {
    const fixture = await render('es-CR');

    await TestBed.inject(LanguageService).use('en');
    await fixture.whenStable();

    expect(control(fixture).value).toBe('en');
    expect(control(fixture).selectedOptions[0]?.textContent?.trim()).toBe('English');
  });

  it('switches language from the control', async () => {
    const fixture = await render('es-CR');

    await choose(fixture, 'en');

    expect(TestBed.inject(LanguageService).active()).toBe('en');
    expect(control(fixture).value).toBe('en');
  });

  it('case A: goes back to the language on screen and tells the user when the dictionary fails', async () => {
    const fixture = await render('es-CR', { es: DICTIONARIES.es });

    await choose(fixture, 'en');

    expect(control(fixture).value).toBe('es');
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent?.trim()).toBe(DICTIONARIES.es.shell.languageSwitcher.unavailable);
    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  it('shows no notice while every dictionary loads', async () => {
    const fixture = await render('es-CR');

    await choose(fixture, 'en');

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
  });
});
