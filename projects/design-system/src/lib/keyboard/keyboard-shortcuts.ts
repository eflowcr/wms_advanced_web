import { DestroyRef, inject, Injectable, signal, type Signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { readMilliseconds } from '../tokens/read-token';
import { ScanDetector, SCAN_THRESHOLD_TOKEN } from './scan-detector';
import {
  isSingleCharacter,
  matches,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutHelpMessages,
  type ShortcutMap,
} from './shortcuts.types';
import { isTextEntry } from './text-entry';

/** Undo a registration. Returned by `register`, and called for you on destroy. */
export type Unregister = () => void;

/**
 * What the engine decided about one keystroke, and why.
 *
 * EXISTS SO THE CATALOGUE CAN SHOW THE TRUTH RATHER THAN A RE-ENACTMENT.
 * `/design-system/patterns/keyboard` shows the last key and how it was
 * classified, and the only honest way to do that is to publish what the engine
 * really concluded -- a page that installed its own listener and worked the
 * answer out again would be demonstrating a second implementation, and the
 * source gate forbids it anyway.
 *
 * It is also what the end-to-end test reads to assert that a scan was
 * classified as a scan, rather than inferring it from a side effect.
 */
export interface ShortcutEvent {
  /** `KeyboardEvent.key`, as the browser reported it. */
  readonly key: string;
  /** The action it turned out to be, or null when it was not a binding. */
  readonly action: ShortcutAction | null;
  readonly outcome: ShortcutOutcome;
}

/**
 * Every way a keystroke can end, in the order `handle` decides them. Each one
 * is a branch somebody could get wrong, so each one has a name.
 */
export type ShortcutOutcome =
  /** Another handler nearer the event already answered it. */
  | 'already-handled'
  /** Inside a scanner run: nothing may act on it (RFE-05). */
  | 'burst'
  /** A run closed on Enter: delivered whole, as one scan (RFE-05). */
  | 'scan'
  /** Not a binding at all. An ordinary keystroke. */
  | 'key'
  /** A binding, but the focus is in a text field and it may not fire (RFE-04). */
  | 'in-text-field'
  /** A binding, but single-character shortcuts are switched off (RFE-09). */
  | 'single-key-off'
  /** A binding nobody registered a handler for. */
  | 'unregistered'
  /** Waiting out one threshold window to be sure it is not a scan. */
  | 'deferred'
  /** A handler ran. */
  | 'shortcut';

/**
 * THE GLOBAL SHORTCUT ENGINE (REQ-FE-DS4-001).
 *
 * One instance for the whole application -- `providedIn: 'root'` -- fed by one
 * document listener that `ewmsShortcutsHost` mounts in the root layout. No
 * screen listens for keys of its own; a screen says WHAT it does with an
 * action and never with which key (RFE-01, RFE-03).
 *
 *
 * THE FOUR THINGS THIS HAS TO GET RIGHT, IN ORDER OF WHAT THEY COST WHEN WRONG
 *
 * 1. A scan must never fire a shortcut. The cost is a wrong inventory
 *    movement. See `handle` and `ScanDetector`.
 * 2. Nothing but Escape may fire inside a text field. The cost is a form
 *    opening over somebody's half-typed code.
 * 3. Ctrl+S must never reach the browser. The cost is a half-finished page
 *    saved to disk and a person who thinks they saved their work.
 * 4. Single-character shortcuts must be switchable off. Not a nicety: WCAG 2.2
 *    2.1.4 requires it, and speech-input users are the ones who need it.
 *
 *
 * WHY THE MAP IS HANDED TO THIS SERVICE RATHER THAN INJECTED BY IT
 *
 * `EWMS_SHORTCUT_MAP` is provided by the root layout COMPONENT, which puts it
 * in an element injector -- the shell provides its own on `MainLayout`, and
 * the showroom provides its own on `ShowroomLayout`, for the bundle reasons
 * each of those files sets out. A `providedIn: 'root'` service resolves from
 * the environment injector, which is above all of that and would find nothing.
 *
 * So the directive injects the map -- it is IN that chain, which is the whole
 * point of it being a directive on the layout -- and mounts it here. The
 * service stays a singleton, so there is one registry of handlers no matter
 * how deep the screen that registers is.
 *
 * `mount` throwing on a second call is HG-04 enforced rather than hoped for: a
 * second `ewmsShortcutsHost` anywhere fails loudly at startup instead of
 * quietly doubling every shortcut.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcuts {
  private readonly map = signal<ShortcutMap | null>(null);
  private readonly messages = signal<ShortcutHelpMessages | null>(null);
  private readonly handlers = new Map<ShortcutAction, () => void>();
  private readonly detector = new ScanDetector();
  private readonly scanned = new Subject<string>();
  private readonly classified = new Subject<ShortcutEvent>();

  /**
   * Whether `/` and `?` act at all. WCAG 2.2 2.1.4 (Character Key Shortcuts)
   * asks for a shortcut that is a single printable character to be switchable
   * off or remappable, and RFE-04 is not enough on its own: it only covers
   * text fields, and 2.1.4 exists for people whose speech input produces
   * characters anywhere.
   *
   * IN MEMORY ONLY. Remembering it needs somewhere to keep a preference per
   * user, which needs the Security Core of the backend (PLN-WMS-005, Sprint 1)
   * -- the same dependency that defers favourites. Declared, not disguised.
   */
  readonly singleKeyShortcuts = signal(true);

  /** Every scan the engine classified, whole, one event per code (RFE-05). */
  readonly scans: Observable<string> = this.scanned.asObservable();

  /**
   * Every keystroke the one listener saw, with what became of it.
   *
   * One emission per keydown, always, including the ones nothing happened to.
   * Cheap by construction -- a small object, and in a zoneless application no
   * change detection unless somebody subscribes and writes a signal -- and it
   * is what lets the catalogue and the end-to-end test read the engine's own
   * conclusion instead of guessing at it from a side effect.
   */
  readonly events: Observable<ShortcutEvent> = this.classified.asObservable();

  /**
   * The map the engine actually dispatches from, or null before a host mounts.
   *
   * NULL IS A REAL STATE AND IS NOT PAPERED OVER: a page rendered on its own
   * in a test bed has no root layout above it, and a page that showed a map
   * nothing was listening to would be the showroom lying. Read by the help
   * dialog and by the keyboard pattern page.
   */
  readonly bindings: Signal<ShortcutMap | null> = this.map.asReadonly();

  /** The help dialog's words, from the same mount. */
  readonly helpMessages: Signal<ShortcutHelpMessages | null> = this.messages.asReadonly();

  /**
   * A single-character shortcut waiting out one threshold window. See
   * `handle` for why it waits.
   */
  private pending: ReturnType<typeof setTimeout> | null = null;

  /**
   * Take over the keyboard. Called by `ewmsShortcutsHost` and by nothing else.
   *
   * @throws if a host is already mounted. Two of them is two document
   *   listeners, which is every shortcut firing twice and the rule in RFE-03
   *   broken -- and it is far better found at startup than by an operator.
   */
  mount(map: ShortcutMap, messages: ShortcutHelpMessages): void {
    if (this.map() !== null) {
      throw new Error(
        'KeyboardShortcuts: a shortcuts host is already mounted. ' +
          'There is exactly one per application, on the root layout (RFE-03).',
      );
    }
    this.map.set(map);
    this.messages.set(messages);
  }

  /** The host went away. Everything it brought goes with it. */
  unmount(): void {
    this.map.set(null);
    this.messages.set(null);
    this.reset();
  }

  /**
   * Say what this screen does with an action.
   *
   * MUST BE CALLED FROM AN INJECTION CONTEXT -- a field initialiser or a
   * constructor -- and that is a contract rather than an accident: it is how
   * the registration learns whose life it shares, so a screen that navigated
   * away stops answering without anybody remembering to say so (RFE-01,
   * PACQ-01.2). Angular's own `takeUntilDestroyed` asks for the same thing for
   * the same reason. The returned function covers the rarer case of a
   * registration shorter-lived than its component -- an open dialog taking
   * over `save`, for instance.
   *
   * REGISTERING AN ACTION TWICE THROWS. A second handler quietly winning, or
   * quietly losing, is how two screens end up disagreeing about what Alt+N
   * does and nobody finds out until an operator does.
   */
  register(action: ShortcutAction, handler: () => void): Unregister {
    if (this.handlers.has(action)) {
      throw new Error(
        `KeyboardShortcuts: "${action}" is already registered. ` +
          'Two handlers for one action is a conflict, not a fallback -- unregister the first.',
      );
    }
    this.handlers.set(action, handler);

    const unregister = (): void => {
      // Only if it is still OURS: a later registration of the same action must
      // not be torn down by an earlier owner's destruction.
      if (this.handlers.get(action) === handler) {
        this.handlers.delete(action);
      }
    };

    inject(DestroyRef).onDestroy(unregister);
    return unregister;
  }

  /** Whether anybody is currently answering this action. Read by the help dialog. */
  isRegistered(action: ShortcutAction): boolean {
    return this.handlers.has(action);
  }

  /**
   * One keydown, from the one listener.
   *
   * THE ORDER OF THE CHECKS IS THE DESIGN. Each one can only be moved by
   * accepting a failure the REQ names, and the comments say which.
   */
  handle(event: KeyboardEvent): void {
    // No host, no map, nothing to dispatch against.
    if (this.map() === null) {
      return;
    }

    /*
     * Somebody nearer the event already answered it -- the dialog closing on
     * Escape is the case that exists today. Answering it again would cancel
     * the screen behind the dialog as well as closing the dialog.
     */
    if (event.defaultPrevented) {
      this.classify(event, null, 'already-handled');
      return;
    }

    const threshold = readMilliseconds(SCAN_THRESHOLD_TOKEN);
    const verdict = this.detector.accept(event, threshold);

    /*
     * ANY key arriving cancels a single-character shortcut that was still
     * waiting. A person who means `/` presses it alone; a gun that emitted `/`
     * as the first character of a code sends the second one microseconds
     * later. This is what makes RFE-05 hold for a code that BEGINS with a
     * shortcut character -- the length of the run cannot tell you that yet,
     * because at the first character there is no run.
     */
    this.cancelPending();

    if (verdict.kind === 'scan') {
      // The whole code, once, as its own event. The keys that made it never
      // reached a handler.
      event.preventDefault();
      this.classify(event, null, 'scan');
      this.scanned.next(verdict.code);
      return;
    }

    if (verdict.kind === 'burst') {
      // Mid-scan. Nothing acts, and nothing is prevented either: the field
      // under the focus, if there is one, is still collecting the code.
      this.classify(event, null, 'burst');
      return;
    }

    const entry = this.find(event);
    if (entry === null) {
      this.classify(event, null, 'key');
      return;
    }
    const [action, binding] = entry;

    /*
     * RFE-02: Ctrl+S never reaches the browser, REGISTERED OR NOT. A screen
     * with nothing to save still must not let the browser write a half-drawn
     * page to disk while the person believes they saved their work.
     */
    if (binding.preventDefault === true) {
      event.preventDefault();
    }

    // RFE-04: inside a field, only the binding that says it may.
    if (isTextEntry(event) && binding.insideTextFields !== true) {
      this.classify(event, action, 'in-text-field');
      return;
    }

    if (!isSingleCharacter(binding)) {
      this.fire(action, event);
      return;
    }

    // WCAG 2.2 2.1.4: switched off, a single character is just a character.
    if (!this.singleKeyShortcuts()) {
      this.classify(event, action, 'single-key-off');
      return;
    }

    /*
     * With no threshold declared there is nothing to wait for and no scan can
     * be recognised anyway, so the shortcut acts at once. Same contract as
     * everywhere else a token is missing: no fallback number lives here.
     */
    if (threshold === null) {
      this.fire(action, event);
      return;
    }

    /*
     * Wait one threshold window -- 50 ms as the token stands, which is well
     * under what anybody perceives -- and act only if nothing else arrived.
     *
     * The default is prevented NOW rather than when the timer runs, and it has
     * to be: by then the event is long finished and `preventDefault` does
     * nothing, so the browser would already have opened its own find-on-page
     * for `/`. The cost of being wrong is that a `/` typed outside a field
     * during a scan produces no character, which is what should happen anyway.
     */
    event.preventDefault();
    this.classify(event, action, 'deferred');
    this.pending = setTimeout(() => {
      this.pending = null;
      const handler = this.handlers.get(action);
      this.classify(event, action, handler === undefined ? 'unregistered' : 'shortcut');
      handler?.();
    }, threshold);
  }

  /** The surface lost the focus, or a route changed: forget the open run. */
  reset(): void {
    this.cancelPending();
    this.detector.reset();
  }

  /**
   * Run the handler now, claiming the key.
   *
   * The default is prevented only when a handler actually answers: an
   * unregistered `Alt+N` has no business swallowing a combination the browser
   * or an assistive technology may want. The one exception is declared on the
   * binding and applied before this is ever reached.
   */
  private fire(action: ShortcutAction, event: KeyboardEvent): void {
    const handler = this.handlers.get(action);
    if (handler === undefined) {
      this.classify(event, action, 'unregistered');
      return;
    }
    event.preventDefault();
    this.classify(event, action, 'shortcut');
    handler();
  }

  private classify(
    event: KeyboardEvent,
    action: ShortcutAction | null,
    outcome: ShortcutOutcome,
  ): void {
    this.classified.next({ key: event.key, action, outcome });
  }

  /** The action this keydown is, or null. */
  private find(event: KeyboardEvent): readonly [ShortcutAction, ShortcutBinding] | null {
    const entries = Object.entries(this.map() ?? {}) as readonly (readonly [
      ShortcutAction,
      ShortcutBinding,
    ])[];
    for (const [action, binding] of entries) {
      if (matches(binding, event)) {
        return [action, binding];
      }
    }
    return null;
  }

  private cancelPending(): void {
    if (this.pending !== null) {
      clearTimeout(this.pending);
      this.pending = null;
    }
  }
}
