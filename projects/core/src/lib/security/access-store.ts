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
  /** Las operaciones de las pantallas: solo un cambio de actor o contexto las aborta. */
  private cancel = new AbortController();
  /** La consulta de permisos en vuelo. */
  private reading = new AbortController();
  private unsubscribe: (() => void) | undefined;
  private running: Promise<void> | null = null;
  private pending: Promise<void> | null = null;
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

  /** Al cerrar sesión: aborta, olvida el gateway y deja todo cerrado hasta el próximo connect. */
  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.gatewayValue = null;
    this.reading.abort();
    this.running = null;
    this.close();
    this.actor.set(null);
    this.demo.set(false);
    this.status.set('idle');
  }

  select(actor: Actor | null): Promise<void> {
    this.actor.set(actor);
    return this.read(true);
  }

  /** Con una lectura en vuelo, las peticiones se juntan en una sola relectura al terminar (RFE-02). */
  refresh(): Promise<void> {
    const running = this.running;
    if (!running) return this.read(false);
    this.pending ??= running.then(() => {
      this.pending = null;
      return this.refresh();
    });
    return this.pending;
  }

  /**
   * Un contexto nuevo vacía, aborta y abre otra generación. Releer el mismo conserva concesiones
   * y operaciones hasta que llegan las nuevas: menú y pestañas no parpadean (C1).
   */
  private read(newContext: boolean): Promise<void> {
    this.reading.abort();
    this.reading = new AbortController();
    const signal = this.reading.signal;
    if (newContext) this.close();
    const gateway = this.gatewayValue;
    if (!gateway) {
      this.close();
      this.status.set('error');
      this.running = null;
      return Promise.resolve();
    }
    if (newContext || !this.ready()) this.status.set('loading');
    const run: Promise<void> = this.load(gateway, signal).finally(() => {
      if (this.running === run) this.running = null;
    });
    this.running = run;
    return run;
  }

  private async load(gateway: SecurityGateway, signal: AbortSignal): Promise<void> {
    try {
      const result = await gateway.access(this.actor(), signal);
      if (signal.aborted) return;
      this.grants.set(result.grants);
      this.user.set(result.user);
      this.status.set('ready');
    } catch {
      if (signal.aborted) return;
      this.close();
      this.status.set('error');
    }
  }

  private close(): void {
    this.cancel.abort();
    this.cancel = new AbortController();
    this.generation.update((n) => n + 1);
    this.grants.set({});
    this.user.set(null);
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
