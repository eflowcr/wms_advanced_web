import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Language } from '@ewms/core';
import { expectNoAxeViolations, provideI18nTesting } from '@ewms/testing';
import { DICTIONARIES } from '../i18n.testing';
import { Home } from './home';

const BROWSER_LOCALE: Readonly<Record<Language, string>> = { es: 'es-CR', en: 'en-US' };

/**
 * Renders Home in a language chosen through the browser language, which
 * startup applies without saving anything.
 */
async function render(language: Language): Promise<HTMLElement> {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(BROWSER_LOCALE[language]);
  await TestBed.configureTestingModule({
    imports: [Home],
    providers: [provideI18nTesting(DICTIONARIES)],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;
  const fixture = TestBed.createComponent(Home);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

function samples(element: HTMLElement, name: string): string[] {
  return [...element.querySelectorAll(`[data-sample="${name}"]`)].map((node) =>
    (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

describe('Home', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each<Language>(['es', 'en'])('has no accessibility violations in %s', async (language) => {
    await expectNoAxeViolations(await render(language));
  });

  it('renders one example of each i18n case from the real dictionaries', async () => {
    const element = await render('en');

    expect(samples(element, 'plural')).toEqual(['No packages', '1 package', '1,250 packages']);
    expect(samples(element, 'number')).toEqual(['Net weight: 12,345.678 kg']);
    expect(samples(element, 'currency')).toEqual(['Amount: CRC 1,250,000.00']);
    expect(samples(element, 'date')[0]).toMatch(/^Today is [A-Z][a-z]+ \d{1,2}, \d{4}$/);
  });

  it('keeps the currency code when the language changes', async () => {
    const element = await render('es');

    expect(samples(element, 'currency')[0]).toMatch(/^Monto: ₡\s?1\s250\s000,00$/);
  });
});
