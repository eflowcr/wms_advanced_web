import { DestroyRef, inject, Injectable, signal, type Signal } from '@angular/core';
import type { FeedbackVariant } from '../feedback/feedback.types';
import { readMilliseconds } from '../tokens/read-token';
import { TOAST_DURATION_TOKEN, type Toast } from './toast.types';

/**
 * Una cola y un outlet por aplicación: una sola región viva. Duración de `--duration-toast`;
 * sin la hoja, no expira (mejor que un tiempo que nadie declaró). Ver vault: Notificaciones.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly queue = signal<readonly Toast[]>([]);

  /** Del más viejo al más nuevo. */
  readonly toasts: Signal<readonly Toast[]> = this.queue.asReadonly();

  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  private nextId = 0;

  constructor() {
    // Un timer sobrevive al inyector destruido; en pruebas el de root se destruye seguido.
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  /** `duration` en ms pisa al token; `0` es «no expira», para un mensaje que hay que leer. */
  show(variant: FeedbackVariant, message: string, duration?: number): number {
    const id = ++this.nextId;
    this.queue.update((current) => [...current, { id, variant, message }]);

    const lifetime = duration ?? readMilliseconds(TOAST_DURATION_TOKEN);
    if (lifetime !== null && lifetime > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), lifetime),
      );
    }
    return id;
  }

  /** Un id que ya no está no hace nada. */
  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.queue.update((current) => current.filter((toast) => toast.id !== id));
  }

  /** Lo que hace `Escape`: el de arriba de la pila. */
  dismissLatest(): void {
    const latest = this.queue()[this.queue().length - 1];
    if (latest) {
      this.dismiss(latest.id);
    }
  }

  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queue.set([]);
  }
}
