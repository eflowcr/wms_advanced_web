import { ApplicationInitStatus, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService, type Language } from '@ewms/core';
import { AccessStore, AuthSession, type SessionInfo } from '@ewms/core/security';
import { expectNoAxeViolations, provideI18nTesting } from '@ewms/testing';
import { DICTIONARIES } from '../i18n.testing';
import { Home } from './home';

const PERSON: SessionInfo = { userId: 'u1', name: 'Ana Rojas', warehouseId: 'A', ownerId: 'X' };

/** Dibuja Home en el idioma pedido con la sesión y las rutas permitidas que se le den. */
async function render(
  language: Language,
  allowed: readonly string[],
  session: SessionInfo | null = PERSON,
): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      provideI18nTesting(DICTIONARIES),
      provideRouter([]),
      { provide: AuthSession, useValue: { session: signal(session) } },
      { provide: AccessStore, useValue: { canRoute: (route: string) => allowed.includes(route) } },
    ],
  }).compileComponents();
  await TestBed.inject(ApplicationInitStatus).donePromise;
  await TestBed.inject(LanguageService).use(language);
  const fixture = TestBed.createComponent(Home);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const text = (node: Element | null): string =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Home', () => {
  it.each<Language>(['es', 'en'])('has no accessibility violations in %s', async (language) => {
    await expectNoAxeViolations(await render(language, ['/configuracion/usuarios']));
  });

  it('greets the person and links only the modules the profile allows', async () => {
    const element = await render('es', ['/configuracion/usuarios', '/configuracion/perfiles']);

    expect(text(element.querySelector('h1'))).toBe('Hola, Ana Rojas');
    const links = [...element.querySelectorAll('a[data-home-module]')];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/configuracion/usuarios',
      '/configuracion/perfiles',
    ]);
    expect(text(links[0]!.querySelector('.text-h4'))).toBe('Usuarios');
    expect(element.querySelector('[data-home-empty]')).toBeNull();
  });

  it('without modules, says so and whom to ask', async () => {
    const element = await render('en', []);

    expect(element.querySelector('a[data-home-module]')).toBeNull();
    expect(text(element.querySelector('[data-home-empty]'))).toContain(
      'You have no modules assigned yet',
    );
  });

  it('without a name, titles the page Home', async () => {
    const element = await render('en', [], null);

    expect(text(element.querySelector('h1'))).toBe('Home');
  });
});
