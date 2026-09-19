import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { FeedbackVariant } from '../feedback/feedback.types';
import { readMilliseconds } from '../tokens/read-token';
import { TOAST_DURATION_TOKEN, type Toast } from './toast.types';

/**
 * The toast queue. ONE of it, for the whole application.
 *
 * `providedIn: 'root'` and a single `<ewms-toast-outlet>` in the root layout
 * are two halves of the same decision: the sheet asks for one shared queue
 * rendered once, rather than a toast per component that raises one. The reason
 * is accessibility before it is tidiness -- a single `aria-live` region means
 * a screen reader is not interrupted afresh by every message, which is exactly
 * what several regions appearing and disappearing would do.
 *
 *
 * WHERE THE DEFAULT LIFETIME COMES FROM
 *
 * `--duration-toast` in tokens.css, read from the document rather than copied
 * here. When the stylesheet is not loaded the read returns null and the toast
 * SIMPLY DOES NOT EXPIRE: it stays until something dismisses it. That is the
 * deliberate answer to "what is the fallback number", which is that there is
 * none -- a fallback constant is a second source of truth that is right until
 * the token moves. A message that stays too long is a nuisance; a message that
 * disappears on a timing nobody declared is a bug nobody can find.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly queue = signal<readonly Toast[]>([]);

  /** What the outlet renders, oldest first. */
  readonly toasts = computed<readonly Toast[]>(() => this.queue());

  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  private nextId = 0;

  constructor() {
    // Timers outlive a destroyed injector unless someone cancels them, and a
    // root service is destroyed in tests far more often than in an app.
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  /**
   * Raise a message and return its id.
   *
   * `duration` is in milliseconds and overrides the token for this one call;
   * `0` means "do not expire", which is how a caller asks for a message that
   * has to be read.
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

  /** Remove one message. Dismissing an id that is gone does nothing. */
  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.queue.update((current) => current.filter((toast) => toast.id !== id));
  }

  /**
   * Remove the most recent message, which is what `Escape` does.
   *
   * The most recent and not the oldest: the newest is the one on top of the
   * stack and the one the key press is aimed at.
   */
  dismissLatest(): void {
    const latest = this.queue()[this.queue().length - 1];
    if (latest) {
      this.dismiss(latest.id);
    }
  }

  /** Drop everything, timers included. */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queue.set([]);
  }
}
