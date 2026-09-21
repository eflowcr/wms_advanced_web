import { Injectable, computed, signal, type Signal } from '@angular/core';
import type { Tab } from '@ewms/design-system';

/**
 * Decisión del equipo (2026-09-19), no límite técnico: por memoria y legibilidad. Al llegar se
 * avisa y se rechaza la nueva; nunca se cierra la más vieja. Ver vault: App-Shell.
 */
export const MAX_OPEN_TABS = 12;

/** Un documento abierto: su ruta y el título que muestra. */
export interface OpenTab extends Tab {
  readonly route: string;
}

/**
 * Documentos abiertos, del shell porque son rutas de esta aplicación (`ewms-tabs` no sabe de
 * rutas). En memoria y se pierden al recargar: la app no usa almacenamiento del navegador.
 */
@Injectable({ providedIn: 'root' })
export class TabsService {
  private readonly open = signal<readonly OpenTab[]>([]);

  readonly tabs: Signal<readonly OpenTab[]> = this.open.asReadonly();

  /** Null antes de que resuelva la primera navegación. */
  private readonly active = signal<string | null>(null);
  readonly activeRoute: Signal<string | null> = this.active.asReadonly();

  readonly isFull = computed(() => this.open().length >= MAX_OPEN_TABS);

  /**
   * Abre la ruta si hacía falta y la activa. `false` si la tira estaba llena: el aviso lo da
   * quien llama, porque este servicio no elige palabras.
   */
  activate(route: string, label: string, closable = true): boolean {
    this.active.set(route);

    if (this.open().some((tab) => tab.route === route)) {
      return true;
    }
    if (this.isFull()) {
      return false;
    }

    this.open.update((tabs) => [...tabs, { id: route, route, label, closable }]);
    return true;
  }

  /** Sin esto, cambiar de idioma dejaba la tira en el anterior (lo que evita el ADR 0008). */
  relabel(route: string, label: string): void {
    this.open.update((tabs) =>
      tabs.map((tab) => (tab.route === route ? { ...tab, label } : tab)),
    );
  }

  /**
   * Devuelve la ruta que debe mostrarse, o `null` si no queda ninguna. La vecina y no la
   * primera: cerrar la tercera de cinco y caer en la primera es un salto que nadie pidió.
   */
  close(route: string): string | null {
    const tabs = this.open();
    const index = tabs.findIndex((tab) => tab.route === route);
    if (index < 0) {
      return this.active();
    }

    const rest = tabs.filter((tab) => tab.route !== route);
    this.open.set(rest);

    if (this.active() !== route) {
      return this.active();
    }
    if (rest.length === 0) {
      this.active.set(null);
      return null;
    }

    const neighbour = rest[Math.min(index, rest.length - 1)];
    const next = neighbour?.route ?? null;
    this.active.set(next);
    return next;
  }
}
