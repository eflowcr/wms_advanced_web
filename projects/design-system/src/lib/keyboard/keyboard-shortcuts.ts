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

/** Deshace un registro. La devuelve `register`, y en destroy se llama sola. */
export type Unregister = () => void;

/**
 * Qué decidió el motor sobre una tecla, y por qué. El catálogo y el E2E leen la
 * conclusión del motor en vez de rehacerla: una página con su propio listener
 * sería una segunda implementación, y la compuerta de código la prohíbe.
 */
export interface ShortcutEvent {
  /** `KeyboardEvent.key`, tal como lo reportó el navegador. */
  readonly key: string;
  /** La acción que resultó ser, o null si no era un atajo. */
  readonly action: ShortcutAction | null;
  readonly outcome: ShortcutOutcome;
}

/**
 * Cómo puede terminar una tecla, en el orden en que `handle` lo decide. Cada una
 * es una rama que alguien podría equivocar, así que cada una tiene nombre.
 */
export type ShortcutOutcome =
  /** Otro handler más cerca del evento ya la atendió. */
  | 'already-handled'
  /** Dentro de una ráfaga de escáner: nada puede actuar sobre ella (RFE-05). */
  | 'burst'
  /** Una ráfaga cerrada con Enter: se entrega entera, como un escaneo (RFE-05). */
  | 'scan'
  /** No era un atajo. Una tecla común. */
  | 'key'
  /** Es un atajo, pero el foco está en un campo y no puede disparar (RFE-04). */
  | 'in-text-field'
  /** Es un atajo, pero los de un solo carácter están apagados (RFE-09). */
  | 'single-key-off'
  /** Un atajo que nadie registró. */
  | 'unregistered'
  /** Esperando una ventana de umbral para asegurarse de que no es un escaneo. */
  | 'deferred'
  /** Corrió un handler. */
  | 'shortcut';

/**
 * El motor global de atajos (REQ-FE-DS4-001). Uno por aplicación, alimentado por
 * el único listener que monta `ewmsShortcutsHost` en el layout raíz: una pantalla
 * dice QUÉ hace con una acción, nunca con qué tecla (RFE-01, RFE-03).
 * Ficha: 08-Sistema-de-Diseno/Componentes/Atajos-de-Teclado.
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
   * Si `/` y `?` actúan. WCAG 2.2 2.1.4 exige poder apagar un atajo de un solo
   * carácter; RFE-04 no alcanza, porque solo cubre campos de texto. EN MEMORIA:
   * recordarlo necesita el Security Core (PLN-WMS-005), igual que favoritos.
   */
  readonly singleKeyShortcuts = signal(true);

  /** Cada escaneo que el motor clasificó, entero, un evento por código (RFE-05). */
  readonly scans: Observable<string> = this.scanned.asObservable();

  /**
   * Cada tecla que vio el único listener, con lo que fue de ella. Una emisión por
   * keydown, siempre, incluidas las que no provocaron nada.
   */
  readonly events: Observable<ShortcutEvent> = this.classified.asObservable();

  /**
   * El mapa desde el que despacha el motor, o null antes de que monte un host.
   * NULL ES UN ESTADO REAL: una página sola en un test bed no tiene layout raíz,
   * y mostrar un mapa que nadie escucha sería el showroom mintiendo.
   */
  readonly bindings: Signal<ShortcutMap | null> = this.map.asReadonly();

  /** Los textos del diálogo de ayuda, del mismo mount. */
  readonly helpMessages: Signal<ShortcutHelpMessages | null> = this.messages.asReadonly();

  /** Un atajo de un carácter esperando su ventana de umbral. Ver `handle`. */
  private pending: ReturnType<typeof setTimeout> | null = null;

  /**
   * Toma el teclado. La llama `ewmsShortcutsHost` y nadie más.
   *
   * @throws si ya hay un host montado. Dos son dos listeners, o sea cada atajo
   *   disparando dos veces, y mejor encontrarlo al arrancar que un operario.
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

  /** El host se fue. Todo lo que trajo se va con él. */
  unmount(): void {
    this.map.set(null);
    this.messages.set(null);
    this.reset();
  }

  /**
   * Dice qué hace esta pantalla con una acción.
   *
   * DESDE UN CONTEXTO DE INYECCIÓN, y es contrato: así el registro sabe de quién
   * es la vida que comparte y una pantalla que navegó deja de responder sola.
   * REGISTRAR DOS VECES LA MISMA ACCIÓN LANZA: un segundo handler ganando en
   * silencio es cómo dos pantallas discrepan sobre qué hace Alt+N.
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
      // Solo si sigue siendo NUESTRO: un registro posterior de la misma acción
      // no lo puede desarmar la destrucción de un dueño anterior.
      if (this.handlers.get(action) === handler) {
        this.handlers.delete(action);
      }
    };

    inject(DestroyRef).onDestroy(unregister);
    return unregister;
  }

  /** Si alguien está respondiendo esta acción. Lo lee el diálogo de ayuda. */
  isRegistered(action: ShortcutAction): boolean {
    return this.handlers.has(action);
  }

  /**
   * Un keydown, del único listener. EL ORDEN DE LAS COMPROBACIONES ES EL DISEÑO:
   * mover una cuesta un fallo que el REQ nombra, y los comentarios dicen cuál.
   */
  handle(event: KeyboardEvent): void {
    // Sin host no hay mapa, y sin mapa no hay contra qué despachar.
    if (this.map() === null) {
      return;
    }

    /*
     * Alguien más cerca del evento ya la atendió, y aun así SE ALIMENTA EL
     * DETECTOR: saltarlo fue un defecto de DS-5. Un código escaneado en un
     * `ewms-search-select` lo resuelve el detector del campo, que hace
     * `preventDefault` sobre el Enter de cierre, así que la ráfaga del motor
     * quedaba abierta hasta el Enter siguiente -y un botón enfocado dejaba de
     * activarse con Enter, WCAG 2.1.1. El veredicto se descarta a propósito:
     * nada puede actuar sobre una tecla ya atendida, solo se lleva la cuenta.
     */
    if (event.defaultPrevented) {
      this.detector.accept(event, readMilliseconds(SCAN_THRESHOLD_TOKEN));
      // Una tecla que llega cancela un carácter que seguía esperando, y una
      // tecla atendida es una tecla que llega. Sin excepción por quién respondió.
      this.cancelPending();
      this.classify(event, null, 'already-handled');
      return;
    }

    const threshold = readMilliseconds(SCAN_THRESHOLD_TOKEN);
    const verdict = this.detector.accept(event, threshold);

    /*
     * CUALQUIER tecla cancela un atajo de un carácter que seguía esperando. Quien
     * quiere `/` lo pulsa solo; una pistola que emitió `/` como primer carácter
     * manda el segundo microsegundos después. Así vale RFE-05 para un código que
     * EMPIEZA por un carácter de atajo, que el largo de la ráfaga no puede ver.
     */
    this.cancelPending();

    if (verdict.kind === 'scan') {
      // El código entero, una vez, como evento propio. Las teclas que lo formaron
      // nunca llegaron a un handler.
      event.preventDefault();
      this.classify(event, null, 'scan');
      this.scanned.next(verdict.code);
      return;
    }

    if (verdict.kind === 'burst') {
      // En plena ráfaga. Nada actúa y nada se previene: el campo bajo el foco, si
      // lo hay, sigue juntando el código.
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
     * RFE-02: Ctrl+S nunca llega al navegador, REGISTRADO O NO. Una pantalla sin
     * nada que guardar tampoco puede dejar que el navegador escriba a disco una
     * página a medio dibujar mientras la persona cree que guardó.
     */
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

    /*
     * Sin umbral declarado no hay nada que esperar y ningún escaneo se puede
     * reconocer, así que el atajo actúa ya. Ningún número de reserva vive acá.
     */
    if (threshold === null) {
      this.fire(action, event);
      return;
    }

    /*
     * Espera una ventana de umbral -50 ms con el token de hoy- y actúa solo si no
     * llegó nada más. EL DEFAULT SE PREVIENE AHORA Y NO EN EL TIMER: para
     * entonces el evento terminó hace rato y `preventDefault` no hace nada, así
     * que el navegador ya habría abierto su buscar-en-página para `/`.
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

  /** La superficie perdió el foco, o cambió una ruta: se olvida la ráfaga abierta. */
  reset(): void {
    this.cancelPending();
    this.detector.reset();
  }

  /**
   * Corre el handler y reclama la tecla. El default se previene solo cuando un
   * handler responde: un `Alt+N` sin registrar no tiene por qué tragarse una
   * combinación que el navegador o una ayuda técnica quizá quieran.
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

  /** La acción que es este keydown, o null. */
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
