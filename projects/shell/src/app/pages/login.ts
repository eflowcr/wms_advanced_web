import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthError, AuthSession, safeReturnUrl, type AuthErrorCode } from '@ewms/core/security';
import { Banner, Button, FormPattern, Input } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { BRAND_NAME } from '../brand';
import { SECURITY_DEMO } from '../demo-mode';
import { provideEwmsDesignSystem } from '../design-system.providers';

/** t(shell.login.invalidCredentials, shell.login.unavailable) */
const FAILURE: Readonly<Record<AuthErrorCode, string>> = {
  invalidCredentials: 'shell.login.invalidCredentials',
  unavailable: 'shell.login.unavailable',
};

/**
 * Capa pública (ADR 0012). Solo habla con el puerto AuthSession: cambiar el mecanismo de inicio
 * de sesión cambia el adaptador, no esta pantalla. La contraseña no sobrevive al intento.
 */
@Component({
  selector: 'app-login',
  imports: [Banner, Button, FormField, FormPattern, Input, TranslocoPipe],
  providers: [provideEwmsDesignSystem()],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <main
      id="main"
      class="flex w-full max-w-96 flex-col gap-6 rounded-md border border-default bg-surface p-6"
      data-login
    >
      <p class="text-caption text-secondary">{{ brandName }}</p>
      <h1 class="text-h1" tabindex="-1" data-page-heading>{{ 'shell.login.title' | transloco }}</h1>
      @if (failure(); as key) {
        <ewms-banner
          variant="danger"
          [severityLabel]="'shell.toast.severity.danger' | transloco"
          [title]="key | transloco"
          data-login-error
        />
      }
      @if (demo) {
        <p class="text-caption text-secondary" data-login-demo>
          {{ 'shell.login.demoHint' | transloco }}
        </p>
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
          [label]="'shell.login.username' | transloco"
          autocomplete="username"
          [formField]="loginForm.username"
        />
        <ewms-input
          type="password"
          autocomplete="current-password"
          [label]="'shell.login.password' | transloco"
          [showPasswordLabel]="'shell.login.showPassword' | transloco"
          [hidePasswordLabel]="'shell.login.hidePassword' | transloco"
          [formField]="loginForm.password"
        />
        <ewms-button type="submit" [loading]="pattern.busy()">
          {{ 'shell.login.submit' | transloco }}
        </ewms-button>
      </form>
    </main>
  `,
})
export class Login {
  private readonly auth = inject(AuthSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly brandName = BRAND_NAME;
  protected readonly demo = SECURITY_DEMO;
  protected readonly failure = signal('');
  private readonly credentials = signal({ username: '', password: '' });
  protected readonly loginForm = form(this.credentials, (path) => {
    required(path.username);
    required(path.password);
  });

  protected readonly signIn = async (): Promise<void> => {
    const { username, password } = this.credentials();
    this.failure.set('');
    this.credentials.set({ username, password: '' });
    try {
      await this.auth.signIn({ username: username.trim(), password });
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'unavailable';
      this.failure.set(FAILURE[code]);
      return;
    }
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    await this.router.navigateByUrl(safeReturnUrl(returnUrl));
  };
}
