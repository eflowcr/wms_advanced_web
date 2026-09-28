import { DestroyRef, inject, Injectable, signal, type Signal } from '@angular/core';
import type { FeedbackVariant } from '../feedback/feedback.types';
import { readMilliseconds } from '../tokens/read-token';
import { TOAST_DURATION_TOKEN, TOAST_LIMIT, type Toast } from './toast.types';

/** Lo que le queda a un mensaje: corre o está en pausa (`timer` vacío). */
interface Lifetime {
  remaining: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Una cola y un outlet por aplicación: una sola región viva. Duración de `--duration-toast`;
 * sin la hoja, no expira (mejor que un tiempo que nadie declaró). Ver vault: Notificaciones.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly queue = signal<readonly Toast[]>([]);

  /** Del más viejo al más nuevo. */
  readonly toasts: Signal<readonly Toast[]> = this.queue.asReadonly();

  private readonly lifetimes = new Map<number, Lifetime>();

  private paused = false;

  private nextId = 0;

  constructor() {
    // Un timer sobrevive al inyector destruido; en pruebas el de root se destruye seguido.
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  /** `duration` en ms pisa al token; `0` es «no expira», para un mensaje que hay que leer. */
  show(variant: FeedbackVariant, message: string, duration?: number): number {
    const id = ++this.nextId;
    this.queue.update((current) => [...current, { id, variant, message }]);
    for (const evicted of this.queue().slice(0, -TOAST_LIMIT)) {
      this.dismiss(evicted.id);
    }

    const lifetime = duration ?? readMilliseconds(TOAST_DURATION_TOKEN);
    if (lifetime !== null && lifetime > 0) {
      this.lifetimes.set(id, { remaining: lifetime, startedAt: 0, timer: undefined });
      if (!this.paused) {
        this.run(id);
      }
    }
    return id;
  }

  /** Un id que ya no está no hace nada. */
  dismiss(id: number): void {
    clearTimeout(this.lifetimes.get(id)?.timer);
    this.lifetimes.delete(id);
    this.queue.update((current) => current.filter((toast) => toast.id !== id));
  }

  /** Lo que hace `Escape`: el de arriba de la pila. */
  dismissLatest(): void {
    const latest = this.queue()[this.queue().length - 1];
    if (latest) {
      this.dismiss(latest.id);
    }
  }

  /** WCAG 2.2.1: con el puntero o el foco en la pila, ningún mensaje se va; guarda lo que quedaba. */
  pause(): void {
    if (this.paused) {
      return;
    }
    this.paused = true;
    const now = Date.now();
    for (const lifetime of this.lifetimes.values()) {
      clearTimeout(lifetime.timer);
      lifetime.timer = undefined;
      lifetime.remaining -= now - lifetime.startedAt;
    }
  }

  /** Cada mensaje sigue con el tiempo que le quedaba, no con uno nuevo. */
  resume(): void {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    for (const id of this.lifetimes.keys()) {
      this.run(id);
    }
  }

  clear(): void {
    for (const lifetime of this.lifetimes.values()) {
      clearTimeout(lifetime.timer);
    }
    this.lifetimes.clear();
    this.queue.set([]);
  }

  private run(id: number): void {
    const lifetime = this.lifetimes.get(id);
    if (lifetime === undefined) {
      return;
    }
    lifetime.startedAt = Date.now();
    lifetime.timer = setTimeout(() => this.dismiss(id), lifetime.remaining);
  }
}
