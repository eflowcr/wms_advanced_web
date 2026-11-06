import { ApplicationInitStatus } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { LanguageService, type Language } from '@ewms/core';
import { AuthError, AuthSession } from '@ewms/core/security';
import { expectNoAxeViolations, pixels, provideI18nTesting } from '@ewms/testing';
import { DICTIONARIES } from '../i18n.testing';
import { Login } from './login';

interface MediaQuery {
  min: number;
  list: MediaQueryList;
  listeners: ((e: unknown) => void)[];
}

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

  /** Una pantalla de `width` px: `matchMedia` contesta los cortes y la preferencia de movimiento. */
  function stubScreen(width: number, reduce = false): (next: number) => void {
    const original = window.matchMedia;
    const queries: MediaQuery[] = [];
    window.matchMedia = ((query: string) => {
      const min = Number(/min-width: (\d+)px/.exec(query)?.[1] ?? NaN);
      const listeners: ((e: unknown) => void)[] = [];
      const list = {
        matches: Number.isNaN(min) ? reduce && query.includes('reduce') : width >= min,
        addEventListener: (_: string, listener: (e: unknown) => void) => listeners.push(listener),
        removeEventListener: () => undefined,
      } as unknown as MediaQueryList;
      queries.push({ min, list, listeners });
      return list;
    }) as typeof window.matchMedia;
    restore.push(() => (window.matchMedia = original));
    return (next) => {
      for (const { min, listeners } of queries) {
        listeners.forEach((listener) => listener({ matches: next >= min }));
      }
    };
  }

  /** Lo que la hoja de estilos daría: el jsdom de las pruebas no la carga. */
  function setToken(name: string, value: string): void {
    document.documentElement.style.setProperty(name, value);
    restore.push(() => document.documentElement.style.removeProperty(name));
  }

  let restore: (() => void)[] = [];
  afterEach(() => {
    restore.forEach((undo) => undo());
    restore = [];
  });

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
    root()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
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

  it('opens on the username, with one h1 and the brand panel out of reach', async () => {
    await render();
    expect(document.activeElement).toBe(field('username'));
    expect(root().querySelectorAll('h1')).toHaveLength(1);
    const brand = root().querySelector('[data-login-brand]')!;
    expect(brand.getAttribute('aria-hidden')).toBe('true');
    expect(brand.querySelector('a, button, input, [tabindex]')).toBeNull();
  });

  it('while signing in, the button is busy and the fields are read-only', async () => {
    await render();
    let finish: () => void = () => undefined;
    signIn.mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve)));
    await submit('admin', 'secreto');
    expect(root().querySelector('button[type="submit"]')?.getAttribute('aria-busy')).toBe('true');
    expect(field('username').readOnly).toBe(true);
    expect(field('current-password').readOnly).toBe(true);
    finish();
    await fixture.whenStable();
  });

  it('a success welcomes, says so to assistive technology and waits its token to leave', async () => {
    setToken('--delay-login-welcome', '40ms');
    await render();
    await submit('admin', 'secreto');
    expect(root().querySelector('[data-login] [role="status"]')?.textContent).toContain(
      'Abriendo su almacén activo…',
    );
    expect(root().querySelector('h1')?.textContent?.trim()).toBe('Bienvenido');
    expect(root().querySelector('[data-login-trace]')).not.toBeNull();
    expect(navigateByUrl).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('with reduced motion a success leaves at once', async () => {
    setToken('--delay-login-welcome', '10s');
    stubScreen(1440, true);
    await render();
    await submit('admin', 'secreto');
    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('a navigation the router refuses brings the form back', async () => {
    await render();
    navigateByUrl.mockResolvedValueOnce(false);
    await submit('admin', 'secreto');
    expect(root().querySelector('[data-login-form]')).not.toBeNull();
    expect(root().querySelector('h1')?.textContent?.trim()).toBe('Iniciar sesión');
  });

  it('splits in two columns, then the brand over a card, then a compact card with 48 px controls', async () => {
    setToken('--breakpoint-login-split', pixels(1024));
    setToken('--breakpoint-nav-bottom', pixels(768));
    const resize = stubScreen(1440);
    await render();
    const card = () => root().querySelector('[data-login]')!;
    const lede = 'Recepción, inventario y despacho';
    expect(root().textContent).toContain(lede);
    expect(card().classList).toContain('rounded-dialog');
    expect(field('username').classList).toContain('h-10');

    resize(900);
    await fixture.whenStable();
    expect(root().textContent).not.toContain(lede);
    expect(card().classList).toContain('rounded-dialog');
    const banner = root().querySelector('header:has([data-language-switcher])');
    expect(banner?.classList).toContain('absolute');

    // Bajo 768 px `Viewport` también contesta: la tarjeta se compacta y los controles crecen.
    resize(390);
    await fixture.whenStable();
    expect(card().classList).toContain('p-6');
    expect(field('username').classList).toContain('h-12');
    expect(root().querySelector('button[type="submit"]')?.classList).toContain('h-12');
  });

  it('a rejection says why, stays here and forgets the password', async () => {
    await render();
    signIn.mockRejectedValueOnce(new AuthError('invalidCredentials'));
    await submit('admin', 'secreto');
    expect(root().querySelector('[data-login-error]')?.textContent).toContain(
      'Usuario o contraseña incorrectos.',
    );
    expect(root().querySelector('[data-login-error] [role="alert"]')).not.toBeNull();
    expect(document.activeElement).toBe(field('username'));
    expect(field('username').readOnly).toBe(false);
    expect(field('current-password').value).toBe('');
    expect(navigateByUrl).not.toHaveBeenCalled();

    signIn.mockRejectedValueOnce(new Error('network'));
    await submit('admin', 'otra');
    expect(root().querySelector('[data-login-error]')?.textContent).toContain(
      'No se pudo iniciar sesión.',
    );
  });
});
