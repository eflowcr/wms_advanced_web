import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { form, FormField, readonly, required } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthError, AuthSession, safeReturnUrl, type AuthErrorCode } from '@ewms/core/security';
import {
  Banner,
  Button,
  FormPattern,
  Icon,
  Input,
  readMilliseconds,
  readPixels,
  ToastOutlet,
  Viewport,
} from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { BRAND_EDITION, BRAND_NAME, BRAND_OWNER, BRAND_TAGLINE } from '../brand';
import { provideEwmsDesignSystem } from '../design-system.providers';
import { LanguageSwitcher } from '../layout/language-switcher';

/** t(shell.login.invalidCredentials, shell.login.secondFactorCancelled, shell.login.unavailable) */
const FAILURE: Readonly<Record<AuthErrorCode, string>> = {
  invalidCredentials: 'shell.login.invalidCredentials',
  secondFactorCancelled: 'shell.login.secondFactorCancelled',
  unavailable: 'shell.login.unavailable',
};

const SPLIT_BREAKPOINT_TOKEN = '--breakpoint-login-split';
const WELCOME_DELAY_TOKEN = '--delay-login-welcome';

/** Dos columnas desde el corte; debajo, marca arriba y tarjeta, compacta bajo 768 px. */
type LoginLayout = 'split' | 'band' | 'compact';

type Phase = 'idle' | 'sending' | 'welcome';

const FRAME_CLASSES: Readonly<Record<LoginLayout, string>> = {
  split: 'relative isolate flex min-h-screen overflow-hidden',
  band: 'relative isolate flex min-h-screen flex-col overflow-hidden',
  compact: 'relative isolate flex min-h-screen flex-col overflow-hidden',
};

const SCRIM_CLASSES: Readonly<Record<LoginLayout, string>> = {
  split: 'absolute inset-0 bg-(image:--login-scrim-split)',
  band: 'absolute inset-0 bg-(image:--login-scrim-stacked)',
  compact: 'absolute inset-0 bg-(image:--login-scrim-stacked)',
};

const BRAND_CLASSES: Readonly<Record<LoginLayout, string>> = {
  split: 'relative flex flex-11 overflow-hidden text-on-dark',
  band: 'relative flex shrink-0 overflow-hidden text-on-dark',
  compact: 'relative flex shrink-0 overflow-hidden text-on-dark',
};

const BRAND_CONTENT_CLASSES: Readonly<Record<LoginLayout, string>> = {
  split: 'flex flex-1 flex-col justify-between gap-12 p-12',
  band: 'flex flex-1 flex-col gap-10 px-6 pt-4 pb-10',
  compact: 'flex flex-1 flex-col gap-8 px-4 pt-4 pb-8',
};

const COLUMN_CLASSES: Readonly<Record<LoginLayout, string>> = {
  split: 'relative flex min-w-0 flex-9 flex-col',
  band: 'relative flex flex-1 flex-col px-6',
  compact: 'relative flex flex-1 flex-col px-4',
};

const PLACE_CLASSES: Readonly<Record<LoginLayout, string>> = {
  split: 'flex flex-1 items-center justify-center px-6',
  band: 'flex w-full flex-1 items-start justify-center',
  compact: 'flex w-full flex-1 items-start justify-center',
};

const CARD_CLASSES: Readonly<Record<LoginLayout, string>> = {
  split:
    'flex w-full max-w-(--login-card-width) flex-col gap-6 rounded-dialog border border-default bg-surface p-8 shadow-dialog',
  band: 'flex w-full max-w-(--login-card-width) flex-col gap-6 rounded-dialog border border-default bg-surface p-8 shadow-dialog',
  compact:
    'flex w-full flex-col gap-6 rounded-dialog border border-default bg-surface p-6 shadow-dialog',
};

/**
 * Capa pública (ADR 0012). Solo habla con el puerto AuthSession: cambiar el mecanismo de inicio
 * de sesión cambia el adaptador, no esta pantalla. La contraseña no sobrevive al intento.
 * Panel de marca, movimiento y bienvenida: solo presentación. Ver vault: App-Shell.
 */
@Component({
  selector: 'app-login',
  imports: [
    Banner,
    Button,
    FormField,
    FormPattern,
    Icon,
    Input,
    LanguageSwitcher,
    ToastOutlet,
    TranslocoPipe,
  ],
  providers: [provideEwmsDesignSystem()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-h-screen bg-brand-navy' },
  template: `
    <div [class]="frame()">
      <!-- La escena, a pantalla completa y fuera del árbol accesible; el velo sostiene el texto blanco. -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 bg-(image:--gradient-login)"
        data-login-scene
      >
        <img
          class="absolute inset-0 size-full object-cover object-right"
          src="/brand/login-scene.webp"
          srcset="/brand/login-scene-960.webp 960w, /brand/login-scene.webp 1920w"
          sizes="100vw"
          width="1920"
          height="1086"
          decoding="async"
          alt=""
        />
        <div [class]="scrim()"></div>
      </div>
      <div [class]="brand()">
        <!-- Decoración: las rutas, la traza del éxito y el mensaje de marca, fuera del árbol accesible. -->
        <div aria-hidden="true" [class]="brandContent()" data-login-brand>
          <img
            class="pointer-events-none absolute inset-0 size-full object-cover"
            src="/brand/login-routes.svg"
            alt=""
          />
          @if (welcome()) {
            <img
              class="pointer-events-none absolute inset-0 size-full object-cover"
              src="/brand/login-trace.svg"
              alt=""
              data-login-trace
            />
          }
          <p class="relative flex h-10 items-center gap-2">
            <img
              class="h-(--brand-wordmark-height) w-auto max-w-none"
              src="/brand/ewms-wordmark-on-dark.svg"
              width="1048"
              height="232"
              alt=""
            />
            <span class="text-h2 text-on-dark-secondary">{{ brandEdition }}</span>
          </p>
          <div class="relative flex max-w-(--login-copy-max-width) flex-col gap-4">
            <p [class]="layout() === 'split' ? 'text-h1' : 'text-h2'">
              {{ 'shell.login.headline' | transloco }}
            </p>
            @if (layout() === 'split') {
              <p class="text-p">{{ 'shell.login.lede' | transloco }}</p>
            }
          </div>
          @if (layout() === 'split') {
            <p class="relative flex items-center gap-4">
              <img
                class="block h-8 w-32 object-cover"
                src="/brand/eprac/eprac-blanco.png"
                width="480"
                height="270"
                alt=""
              />
              <span class="text-caption text-on-dark-secondary">{{ brandTagline }}</span>
            </p>
          }
        </div>
        <!-- El idioma, en la cabecera de la página: todo lo legible vive en un landmark. -->
        @if (layout() !== 'split') {
          <header class="absolute top-4 right-4"><app-language-switcher /></header>
        }
      </div>

      <div [class]="column()">
        @if (layout() === 'split') {
          <header class="flex justify-end p-6"><app-language-switcher /></header>
        }
        <div [class]="place()">
          <main id="main" [class]="card()" data-login>
            <header class="flex flex-col gap-2 motion-safe:animate-login-rise">
              <img
                class="mb-2 size-10"
                src="/brand/ewms-isotipo.svg"
                width="40"
                height="40"
                [alt]="brandName"
              />
              <h1 class="text-h1" tabindex="-1" data-page-heading>
                @if (welcome()) {
                  {{ 'shell.login.welcome' | transloco }}
                } @else {
                  {{ 'shell.login.title' | transloco }}
                }
              </h1>
              @if (!welcome()) {
                <p class="text-p text-secondary">{{ 'shell.login.subtitle' | transloco }}</p>
              }
            </header>
            @if (welcome()) {
              <div
                class="flex items-center gap-3 rounded-md border border-success bg-success-surface p-4 text-success motion-safe:animate-login-rise"
                data-login-welcome
              >
                <ewms-icon name="circle-check" size="lg" />
                <p class="text-p">{{ 'shell.login.entering' | transloco }}</p>
              </div>
            } @else {
              @if (failure(); as key) {
                <ewms-banner
                  class="motion-safe:animate-login-alert"
                  variant="danger"
                  [severityLabel]="'shell.toast.severity.danger' | transloco"
                  [title]="key | transloco"
                  data-login-error
                />
              }
              <form
                [ewmsForm]="loginForm"
                [ewmsFormAction]="signIn"
                [summary]="false"
                #pattern="ewmsForm"
                class="flex flex-col gap-4"
                data-login-form
              >
                <ewms-input
                  class="motion-safe:animate-login-rise [--login-step:1]"
                  [size]="controlSize()"
                  [error]="failure() !== ''"
                  [label]="'shell.login.username' | transloco"
                  autocomplete="username"
                  [formField]="loginForm.username"
                />
                <ewms-input
                  class="motion-safe:animate-login-rise [--login-step:2]"
                  type="password"
                  autocomplete="current-password"
                  [size]="controlSize()"
                  [error]="failure() !== ''"
                  [label]="'shell.login.password' | transloco"
                  [showPasswordLabel]="'shell.login.showPassword' | transloco"
                  [hidePasswordLabel]="'shell.login.hidePassword' | transloco"
                  [formField]="loginForm.password"
                />
                <ewms-button
                  class="w-full flex-col motion-safe:animate-login-rise [--login-step:3]"
                  type="submit"
                  [size]="controlSize()"
                  [loading]="pattern.busy()"
                >
                  @if (pattern.busy()) {
                    {{ 'shell.login.submitting' | transloco }}
                  } @else {
                    {{ 'shell.login.submit' | transloco }}
                  }
                </ewms-button>
              </form>
            }
            <!-- Vivo desde el principio: una región que nace con el texto no siempre se anuncia. -->
            <p role="status" class="sr-only">
              @if (welcome()) {
                <span>{{ 'shell.login.welcome' | transloco }}</span>
                <span>{{ 'shell.login.entering' | transloco }}</span>
              }
            </p>
          </main>
        </div>
        <footer class="p-6 text-center text-caption text-on-dark">
          {{ brandOwner }}
        </footer>
      </div>
    </div>

    <!-- La capa pública no monta el marco: el aviso del conmutador de idioma sale por este outlet. -->
    <ewms-toast-outlet
      [severityLabels]="{
        success: 'shell.toast.severity.success' | transloco,
        warning: 'shell.toast.severity.warning' | transloco,
        danger: 'shell.toast.severity.danger' | transloco,
        info: 'shell.toast.severity.info' | transloco,
      }"
      [regionLabel]="'shell.toast.region' | transloco"
      [dismissLabel]="'shell.toast.dismiss' | transloco"
    />
  `,
})
export class Login {
  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly viewport = inject(Viewport);
  protected readonly brandName = BRAND_NAME;
  protected readonly brandEdition = BRAND_EDITION;
  protected readonly brandTagline = BRAND_TAGLINE;
  protected readonly brandOwner = BRAND_OWNER;
  protected readonly failure = signal('');
  private readonly phase = signal<Phase>('idle');
  protected readonly welcome = computed(() => this.phase() === 'welcome');
  private readonly credentials = signal({ username: '', password: '' });
  protected readonly loginForm = form(this.credentials, (path) => {
    required(path.username);
    required(path.password);
    // Mientras se envía, los campos quedan bloqueados sin perder el foco que tenían.
    readonly(path.username, { when: () => this.phase() !== 'idle' });
    readonly(path.password, { when: () => this.phase() !== 'idle' });
  });

  /** Sin el token gana el ancho, como en `Viewport`. */
  private readonly split = signal(true);
  protected readonly layout = computed<LoginLayout>(() => {
    if (this.split()) {
      return 'split';
    }
    return this.viewport.isWide() ? 'band' : 'compact';
  });
  /** Bajo 768 px los campos y el botón miden 48 px. */
  protected readonly controlSize = computed(() => (this.layout() === 'compact' ? 'lg' : 'md'));
  protected readonly frame = computed(() => FRAME_CLASSES[this.layout()]);
  protected readonly scrim = computed(() => SCRIM_CLASSES[this.layout()]);
  protected readonly brand = computed(() => BRAND_CLASSES[this.layout()]);
  protected readonly brandContent = computed(() => BRAND_CONTENT_CLASSES[this.layout()]);
  protected readonly column = computed(() => COLUMN_CLASSES[this.layout()]);
  protected readonly place = computed(() => PLACE_CLASSES[this.layout()]);
  protected readonly card = computed(() => CARD_CLASSES[this.layout()]);

  constructor() {
    this.followSplit();
    afterNextRender(() => this.loginForm.username().focusBoundControl());
  }

  protected readonly signIn = async (): Promise<void> => {
    const { username, password } = this.credentials();
    this.failure.set('');
    this.phase.set('sending');
    this.credentials.set({ username, password: '' });
    try {
      await this.auth.signIn({ username: username.trim(), password });
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'unavailable';
      this.failure.set(FAILURE[code]);
      this.phase.set('idle');
      this.loginForm.username().focusBoundControl();
      return;
    }
    this.phase.set('welcome');
    await pause(this.welcomeDelay());
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!(await this.router.navigateByUrl(safeReturnUrl(returnUrl)))) {
      this.phase.set('idle');
    }
  };

  /** Con movimiento reducido no se espera; sin el token tampoco: la espera es solo de la vista. */
  private welcomeDelay(): number {
    const reduce = this.document.defaultView?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    return reduce ? 0 : (readMilliseconds(WELCOME_DELAY_TOKEN) ?? 0);
  }

  private followSplit(): void {
    const view = this.document.defaultView;
    const breakpoint = readPixels(SPLIT_BREAKPOINT_TOKEN);
    if (view === null || breakpoint === null) {
      return;
    }
    const query = view.matchMedia(`(min-width: ${breakpoint}px)`);
    this.split.set(query.matches);
    const onChange = (event: MediaQueryListEvent): void => this.split.set(event.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
  }
}

function pause(milliseconds: number): Promise<void> {
  return milliseconds > 0
    ? new Promise((resolve) => setTimeout(resolve, milliseconds))
    : Promise.resolve();
}
