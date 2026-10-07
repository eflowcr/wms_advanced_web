import { ApplicationInitStatus } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { LanguageService, type Language } from '@ewms/core';
import { AuthError, AuthSession } from '@ewms/core/security';
import { expectNoAxeViolations, provideI18nTesting } from '@ewms/testing';
import { DICTIONARIES } from '../i18n.testing';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let signIn: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;

  async function render(language: Language = 'es', returnUrl: string | null = null) {
    signIn = vi.fn(async () => undefined);
    navigateByUrl = vi.fn(async () => true);
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideI18nTesting(DICTIONARIES),
        { provide: AuthSession, useValue: { signIn } },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    }).compileComponents();
    await TestBed.inject(ApplicationInitStatus).donePromise;
    await TestBed.inject(LanguageService).use(language);
    fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const field = (purpose: string) =>
    root().querySelector<HTMLInputElement>(`input[autocomplete="${purpose}"]`)!;

  async function submit(username: string, password: string): Promise<void> {
    for (const [purpose, value] of [
      ['username', username],
      ['current-password', password],
    ] as const) {
      const input = field(purpose);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    // Como en el navegador: lo tecleado se dibuja antes de que alguien pulse Entrar.
    await fixture.whenStable();
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it.each<Language>(['es', 'en'])('has no accessibility violations in %s', async (language) => {
    await render(language);
    await expectNoAxeViolations(root());
    expect(root().querySelector('h1')?.textContent?.trim()).toBe(
      language === 'es' ? 'Iniciar sesión' : 'Sign in',
    );
  });

  it('declares the purpose of both fields for password managers (WCAG 1.3.5)', async () => {
    await render();
    expect(field('username')).not.toBeNull();
    expect(field('current-password').type).toBe('password');
  });

  it('signs in through the port and returns to the requested address', async () => {
    await render('es', '/configuracion/usuarios?state=inactive');
    await submit(' admin ', 'secreto');
    expect(signIn).toHaveBeenCalledWith({ username: 'admin', password: 'secreto' });
    expect(navigateByUrl).toHaveBeenCalledWith('/configuracion/usuarios?state=inactive');
  });

  it('never follows a return address outside the console', async () => {
    await render('es', 'https://evil.example/');
    await submit('admin', 'secreto');
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('does not send an empty form', async () => {
    await render();
    await submit('', '');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('a rejection says why, stays here and forgets the password', async () => {
    await render();
    signIn.mockRejectedValueOnce(new AuthError('invalidCredentials'));
    await submit('admin', 'secreto');
    expect(root().querySelector('[data-login-error]')?.textContent).toContain(
      'Usuario o contraseña incorrectos.',
    );
    expect(field('current-password').value).toBe('');
    expect(navigateByUrl).not.toHaveBeenCalled();

    signIn.mockRejectedValueOnce(new Error('network'));
    await submit('admin', 'otra');
    expect(root().querySelector('[data-login-error]')?.textContent).toContain(
      'No se pudo iniciar sesión.',
    );
  });
});
