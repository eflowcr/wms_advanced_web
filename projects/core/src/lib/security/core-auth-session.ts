import { computed, inject, Injectable, Injector, signal } from '@angular/core';
import { AuthSession, type Credentials, type SessionGrant } from './auth-session';
import type { CoreAuthAdapter } from './core-auth-adapter';

/**
 * AuthSession de la API Go (ADR 0028). Fachada liviana: el adaptador carga con el primer login o
 * la primera renovación, fuera del bundle inicial; sin sesión no hay nada que cerrar.
 */
@Injectable({ providedIn: 'root' })
export class CoreAuthSession extends AuthSession {
  private readonly injector = inject(Injector);
  private readonly adapter = signal<CoreAuthAdapter | null>(null);
  private loading: Promise<CoreAuthAdapter> | null = null;

  readonly session = computed(() => this.adapter()?.session() ?? null);

  token(): string | null {
    return this.adapter()?.token() ?? null;
  }

  async signIn(credentials: Credentials): Promise<void> {
    return (await this.load()).signIn(credentials);
  }

  async renew(): Promise<boolean> {
    return (await this.load()).renew();
  }

  async signOut(): Promise<void> {
    return this.adapter()?.signOut();
  }

  adopt(grant: SessionGrant): void {
    const loaded = this.adapter();
    if (loaded) loaded.adopt(grant);
    else void this.load().then((adapter) => adapter.adopt(grant));
  }

  /** Valida el código del segundo factor (login o acción sensible) contra `/auth/verify-mfa`. */
  async verifyPasscode(passcode: string): Promise<void> {
    return (await this.load()).verifyPasscode(passcode);
  }

  private load(): Promise<CoreAuthAdapter> {
    this.loading ??= import('./core-auth-adapter').then(({ CoreAuthAdapter }) => {
      const adapter = this.injector.get(CoreAuthAdapter);
      this.adapter.set(adapter);
      return adapter;
    });
    return this.loading;
  }
}
