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

/** Se llama sola en destroy. */
export type Unregister = () => void;

/** Lo que concluyó el motor; catálogo y E2E lo leen en vez de escuchar aparte (lo prohíbe CI). */
export interface ShortcutEvent {
  readonly key: string;
  /** Null si no era un atajo. */
  readonly action: ShortcutAction | null;
  readonly outcome: ShortcutOutcome;
}

/** Cómo termina una tecla, en el orden en que `handle` lo decide. */
export type ShortcutOutcome =
  | 'already-handled'
  /** Dentro de una ráfaga: nada actúa (RFE-05). */
  | 'burst'
  /** Ráfaga cerrada con Enter: se entrega entera (RFE-05). */
  | 'scan'
  | 'key'
  /** Atajo con el foco en un campo (RFE-04). */
  | 'in-text-field'
  /** Atajos de un carácter apagados (RFE-09). */
  | 'single-key-off'
  | 'unregistered'
  /** Espera una ventana de umbral por si es un escaneo. */
  | 'deferred'
  | 'shortcut';

/**
 * Motor global de atajos (REQ-FE-DS4-001), alimentado por el único listener de `ewmsShortcutsHost`.
 * Se registra la acción, nunca la tecla (RFE-01, RFE-03). Ver vault: Atajos-de-Teclado.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcuts {
  private readonly map = signal<ShortcutMap | null>(null);
  private readonly messages = signal<ShortcutHelpMessages | null>(null);
  private readonly handlers = new Map<ShortcutAction, () => void>();
  private readonly detector = new ScanDetector();
  private readonly scanned = new Subject<string>();
  private readonly classified = new Subject<ShortcutEvent>();

  /** WCAG 2.2 2.1.4: `/` y `?` se pueden apagar. En memoria hasta el Security Core (PLN-WMS-005). */
  readonly singleKeyShortcuts = signal(true);

  /** Un evento por código escaneado, entero (RFE-05). */
  readonly scans: Observable<string> = this.scanned.asObservable();

  /** Una emisión por keydown, incluidas las que no provocaron nada. */
  readonly events: Observable<ShortcutEvent> = this.classified.asObservable();

  /** Null sin host montado, y es un estado real: un test bed no tiene layout raíz. */
  readonly bindings: Signal<ShortcutMap | null> = this.map.asReadonly();

  readonly helpMessages: Signal<ShortcutHelpMessages | null> = this.messages.asReadonly();

  /** Atajo de un carácter esperando su ventana de umbral. */
  private pending: ReturnType<typeof setTimeout> | null = null;

  /**
   * Solo la llama `ewmsShortcutsHost`.
   * @throws si ya hay un host: dos listeners disparan cada atajo dos veces.
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

  unmount(): void {
    this.map.set(null);
    this.messages.set(null);
    this.reset();
  }

  /**
   * Desde un contexto de inyección, para desregistrar sola al destruirse. Registrar dos
   * veces la misma acción lanza. Ver vault: Atajos-de-Teclado.
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
      // Solo si sigue siendo nuestro: destruir un dueño anterior no desarma al actual.
      if (this.handlers.get(action) === handler) {
        this.handlers.delete(action);
      }
    };

    inject(DestroyRef).onDestroy(unregister);
    return unregister;
  }

  isRegistered(action: ShortcutAction): boolean {
    return this.handlers.has(action);
  }

  /** El orden de las comprobaciones es el diseño: mover una rompe el RFE nombrado en ese paso. */
  handle(event: KeyboardEvent): void {
    if (this.map() === null) {
      return;
    }

    // Ya atendida, pero el detector se alimenta igual (defecto de DS-5): tras un escaneo en
    // search-select la ráfaga quedaba abierta y el Enter siguiente no activaba un botón
    // (WCAG 2.1.1). Ver vault: Atajos-de-Teclado.
    if (event.defaultPrevented) {
      this.detector.accept(event, readMilliseconds(SCAN_THRESHOLD_TOKEN));
      // Toda tecla que llega cancela un carácter en espera, también una ya atendida.
      this.cancelPending();
      this.classify(event, null, 'already-handled');
      return;
    }

    const threshold = readMilliseconds(SCAN_THRESHOLD_TOKEN);
    const verdict = this.detector.accept(event, threshold);

    // RFE-05 con un código que empieza por un carácter de atajo: el segundo carácter llega
    // enseguida y cancela la espera. Ver vault: Atajos-de-Teclado.
    this.cancelPending();

    if (verdict.kind === 'scan') {
      // El código entero, una vez; sus teclas nunca llegaron a un handler.
      event.preventDefault();
      this.classify(event, null, 'scan');
      this.scanned.next(verdict.code);
      return;
    }

    if (verdict.kind === 'burst') {
      // Nada actúa ni se previene: el campo con foco sigue juntando el código.
      this.classify(event, null, 'burst');
      return;
    }

    const entry = this.find(event);
    if (entry === null) {
      this.classify(event, null, 'key');
      return;
    }
    const [action, binding] = entry;

    // RFE-02: Ctrl+S nunca llega al navegador, registrado o no. Ver vault: Atajos-de-Teclado.
    if (binding.preventDefault === true) {
      event.preventDefault();
    }

    // RFE-04: dentro de un campo, solo el atajo que dice que puede.
    if (isTextEntry(event) && binding.insideTextFields !== true) {
      this.classify(event, action, 'in-text-field');
      return;
    }

    if (!isSingleCharacter(binding)) {
      this.fire(action, event);
      return;
    }

    // WCAG 2.2 2.1.4: apagado, un carácter es solo un carácter.
    if (!this.singleKeyShortcuts()) {
      this.classify(event, action, 'single-key-off');
      return;
    }

    // Sin umbral no hay escaneo que reconocer: actúa ya, sin número de reserva.
    if (threshold === null) {
      this.fire(action, event);
      return;
    }

    // Espera el umbral (50 ms hoy) y actúa si no llegó nada más. El default se previene
    // ahora: en el timer ya no surte efecto y `/` abriría el buscar-en-página.
    event.preventDefault();
    this.classify(event, action, 'deferred');
    this.pending = setTimeout(() => {
      this.pending = null;
      const handler = this.handlers.get(action);
      this.classify(event, action, handler === undefined ? 'unregistered' : 'shortcut');
      handler?.();
    }, threshold);
  }

  /** Pérdida de foco o cambio de ruta: olvida la ráfaga abierta. */
  reset(): void {
    this.cancelPending();
    this.detector.reset();
  }

  /** Previene el default solo si un handler responde: un Alt+N libre queda para el navegador. */
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
