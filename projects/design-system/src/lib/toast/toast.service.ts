import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { FeedbackVariant } from '../feedback/feedback.types';
import { readMilliseconds } from '../tokens/read-token';
import { TOAST_DURATION_TOKEN, type Toast } from './toast.types';

/**
 * La cola de toasts. UNA para toda la aplicación: `providedIn: 'root'` y un solo
 * `<ewms-toast-outlet>` en el layout raíz son dos mitades de lo mismo, y la razón
 * es accesibilidad antes que orden -una sola región `aria-live` es un lector de
 * pantalla al que no interrumpe cada mensaje de cero-.
 * La duración por defecto sale de `--duration-toast`, leída del documento y no
 * copiada acá. Sin la hoja cargada la lectura da null y el toast NO EXPIRA: queda
 * hasta que algo lo descarte. Un mensaje que dura de más molesta; uno que
 * desaparece con un tiempo que nadie declaró es un defecto que nadie encuentra.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly queue = signal<readonly Toast[]>([]);

  /** Lo que pinta el outlet, del más viejo al más nuevo. */
  readonly toasts = computed<readonly Toast[]>(() => this.queue());

  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  private nextId = 0;

  constructor() {
    // Un temporizador sobrevive a un inyector destruido si nadie lo cancela, y un
    // servicio de root se destruye mucho más seguido en pruebas que en la app.
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  /**
   * Levanta un mensaje y devuelve su id. `duration` va en milisegundos y pisa al
   * token para esta llamada; `0` es «no expira», que es cómo se pide un mensaje
   * que hay que leer.
   */
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

  /** Quita un mensaje. Descartar un id que ya no está no hace nada. */
  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.queue.update((current) => current.filter((toast) => toast.id !== id));
  }

  /** Quita el más reciente, que es lo que hace `Escape`: es el de arriba de la
   * pila y al que apunta la pulsación. */
  dismissLatest(): void {
    const latest = this.queue()[this.queue().length - 1];
    if (latest) {
      this.dismiss(latest.id);
    }
  }

  /** Tira todo, temporizadores incluidos. */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queue.set([]);
  }
}
