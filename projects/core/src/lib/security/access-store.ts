import { Injectable, computed, signal } from '@angular/core';
import {
  SCREEN_CATALOG,
  SecurityError,
  type Actor,
  type Grants,
  type SecurityGateway,
  type SecurityRequest,
  type SecurityUser,
} from './access';

@Injectable({ providedIn: 'root' })
export class AccessStore {
  private gatewayValue: SecurityGateway | null = null;
  private cancel = new AbortController();
  private unsubscribe: (() => void) | undefined;
  readonly actor = signal<Actor | null>(null);
  readonly status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly grants = signal<Grants>({});
  readonly user = signal<SecurityUser | null>(null);
  readonly demo = signal(false);
  readonly generation = signal(0);
  readonly ready = computed(() => this.status() === 'ready');

  connect(gateway: SecurityGateway, actor: Actor, demo = false): Promise<void> {
    this.unsubscribe?.();
    this.gatewayValue = gateway;
    this.demo.set(demo);
    this.unsubscribe = gateway.subscribe(() => {
      void this.refresh();
    });
    return this.select(actor);
  }

  select(actor: Actor | null): Promise<void> {
    this.actor.set(actor);
    return this.refresh();
  }

  async refresh(): Promise<void> {
    this.cancel.abort();
    this.cancel = new AbortController();
    const signal = this.cancel.signal;
    this.generation.update((n) => n + 1);
    this.grants.set({});
    this.user.set(null);
    if (!this.gatewayValue) {
      this.status.set('error');
      return;
    }
    this.status.set('loading');
    try {
      const result = await this.gatewayValue.access(this.actor(), signal);
      if (signal.aborted) return;
      this.grants.set(result.grants);
      this.user.set(result.user);
      this.status.set('ready');
    } catch {
      if (!signal.aborted) this.status.set('error');
    }
  }

  can(capability: string): boolean {
    return this.ready() && (this.grants()[capability]?.length ?? 0) > 0;
  }

  canRoute(url: string): boolean {
    const path = url.split(/[?#]/)[0] ?? '/';
    if (path === '/' || path === '/design-system' || path.startsWith('/design-system/'))
      return true;
    const screen = SCREEN_CATALOG.find(
      (s) => s.route === path || (s.route !== '/' && path.startsWith(`${s.route}/`)),
    );
    return screen !== undefined && this.can(`${screen.id}.view`);
  }

  request(capability: string): SecurityRequest {
    const actor = this.actor();
    if (!actor || !this.can(capability)) throw new SecurityError('denied');
    return { actor: { ...actor }, signal: this.cancel.signal };
  }

  get gateway(): SecurityGateway {
    if (!this.gatewayValue) throw new SecurityError('unavailable');
    return this.gatewayValue;
  }
}
