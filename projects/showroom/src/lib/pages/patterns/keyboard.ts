import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  DESIGN_SYSTEM_VERSION,
  isSingleCharacter,
  KeyboardShortcuts,
  SCAN_MIN_KEYSTROKES,
  type ShortcutAction,
  type ShortcutEvent,
  type ShortcutOutcome,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { TokenValue } from '../../ui/token-value';

/** Una línea del registro en vivo: qué llegó y qué pasó con eso. */
interface LogLine {
  readonly id: number;
  readonly key: string;
  readonly outcome: ShortcutOutcome;
  readonly action: ShortcutAction | null;
}

// Qué significa cada resultado, en una frase escrita y no derivada del nombre: quien aprieta
// una tecla quiere saber por qué no pasó nada, e «in-text-field» no es respuesta.
const OUTCOMES: Readonly<Record<ShortcutOutcome, string>> = {
  'already-handled': 'Otro componente más cercano ya la respondió; el motor no la vuelve a tocar.',
  burst: 'Llegó dentro de una ráfaga de escáner. Ningún atajo puede actuar sobre ella.',
  scan: 'Cerró una ráfaga: se entrega el código entero, una sola vez, como evento propio.',
  key: 'No es ninguna tecla del mapa. Tecla normal.',
  'in-text-field':
    'Es un atajo, pero el foco está en un campo de texto y este no puede dispararse.',
  'single-key-off': 'Es un atajo de una sola tecla y el conmutador de WCAG 2.1.4 está apagado.',
  unregistered: 'Es un atajo del mapa, pero ninguna pantalla registró esa acción.',
  deferred: 'Es de una sola tecla: el motor espera un umbral para descartar que sea un escaneo.',
  shortcut: 'Se disparó el manejador de la acción.',
};

/** Color de una línea del registro según cuánto importa. */
const OUTCOME_TONE: Readonly<Record<ShortcutOutcome, string>> = {
  'already-handled': 'text-secondary',
  burst: 'text-warning',
  scan: 'text-success',
  key: 'text-secondary',
  'in-text-field': 'text-warning',
  'single-key-off': 'text-warning',
  unregistered: 'text-secondary',
  deferred: 'text-secondary',
  shortcut: 'text-success',
};

const PROPS: readonly PropRow[] = [
  {
    name: 'register(action, handler)',
    type: '=> Unregister',
    default: '—',
    description:
      'Dice qué hace esta pantalla con una acción. Desde un contexto de inyección: el registro se retira solo al destruirse. Registrar dos veces la misma acción lanza.',
  },
  {
    name: 'isRegistered(action)',
    type: '=> boolean',
    default: '—',
    description: 'Si alguien está respondiendo esa acción ahora mismo.',
  },
  {
    name: 'singleKeyShortcuts',
    type: 'WritableSignal<boolean>',
    default: 'true',
    description:
      'El conmutador de WCAG 2.2 2.1.4. Apagado, «/» y «?» dejan de actuar; Alt+N y Ctrl+S siguen. En memoria: la preferencia por usuario depende del backend.',
  },
  {
    name: 'scans',
    type: 'Observable<string>',
    default: '—',
    description: 'Cada escaneo, con el código completo, una sola vez. Nunca teclas sueltas.',
  },
  {
    name: 'events',
    type: 'Observable<ShortcutEvent>',
    default: '—',
    description:
      'Cada pulsación que vio el único listener, con lo que el motor decidió. Es de donde sale la tabla de acá arriba.',
  },
  {
    name: 'bindings',
    type: 'Signal<ShortcutMap | null>',
    default: 'null',
    description:
      'El mapa desde el que el motor despacha, o null si ningún layout raíz lo montó. La ayuda lo lee de acá.',
  },
  {
    name: '[ewmsShortcutsHost]',
    type: 'directiva',
    default: '—',
    description:
      'El único listener de la aplicación, en el layout raíz. Montar un segundo lanza en vez de duplicar cada atajo.',
  },
];

const ANATOMY = [
  { part: 'Umbral de ráfaga de escáner, por tecla', token: '--threshold-scan-keystroke' },
  { part: 'Fondo de la tecla en la ayuda (kbd)', token: '--color-bg-secondary' },
  { part: 'Borde de la tecla en la ayuda', token: '--color-border-default' },
  { part: 'Radio del diálogo de ayuda', token: '--radius-dialog' },
  { part: 'Elevación del diálogo de ayuda', token: '--shadow-dialog' },
] as const;

/** Líneas que se guardan del registro; un escaneo solo ya son una docena. */
const LOG_LENGTH = 12;

/**
 * Ficha del motor de atajos (REQ-FE-DS4-001). La demo es el motor real: lee
 * `KeyboardShortcuts.events` y no instala oyente propio (check-shortcuts.mjs lo prohíbe).
 */
// Registra `search` y `create`; `save` queda sin registrar a propósito para mostrar
// `unregistered`, y Ctrl+S igual debe impedir que el navegador guarde la página.
@Component({
  selector: 'ewms-showroom-keyboard',
  imports: [DemoFrame, PropTable, TokenValue],
  templateUrl: './keyboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomKeyboard {
  private readonly shortcuts = inject(KeyboardShortcuts);

  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly props = PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly minKeystrokes = SCAN_MIN_KEYSTROKES;
  protected readonly outcomes = OUTCOMES;

  // En el orden en que `handle` decide. Arreglo y no el pipe `keyvalue`, que ordena por clave:
  // el orden de los chequeos es el contenido del bloque.
  protected readonly outcomeRows = (Object.keys(OUTCOMES) as ShortcutOutcome[]).map((outcome) => ({
    outcome,
    meaning: OUTCOMES[outcome],
  }));

  protected readonly log = signal<readonly LogLine[]>([]);
  protected readonly lastScan = signal<string | null>(null);
  protected readonly searchHits = signal(0);
  protected readonly createHits = signal(0);

  protected readonly singleKeyShortcuts = this.shortcuts.singleKeyShortcuts;

  // El mapa sale del motor, no del token: en ejecución es el del shell, que montó el motor.
  // Una aplicación, un motor, un mapa. El del showroom es para servirlo solo y para las pruebas.
  protected readonly bindings = computed(() => {
    const map = this.shortcuts.bindings();
    if (map === null) {
      return [];
    }
    return (Object.entries(map) as (readonly [ShortcutAction, (typeof map)[ShortcutAction]])[]).map(
      ([action, binding]) => ({
        action,
        chord: binding.chord.join(' + '),
        singleKey: isSingleCharacter(binding),
        insideTextFields: binding.insideTextFields === true,
        registered: this.shortcuts.isRegistered(action),
      }),
    );
  });

  protected readonly mounted = computed(() => this.shortcuts.bindings() !== null);

  private nextId = 0;

  constructor() {
    this.shortcuts.events.pipe(takeUntilDestroyed()).subscribe((event) => this.record(event));
    this.shortcuts.scans.pipe(takeUntilDestroyed()).subscribe((code) => this.lastScan.set(code));

    this.shortcuts.register('search', () => this.searchHits.update((n) => n + 1));
    this.shortcuts.register('create', () => this.createHits.update((n) => n + 1));
  }

  protected toneFor(outcome: ShortcutOutcome): string {
    return OUTCOME_TONE[outcome];
  }

  protected clear(): void {
    this.log.set([]);
    this.lastScan.set(null);
    this.searchHits.set(0);
    this.createHits.set(0);
  }

  private record(event: ShortcutEvent): void {
    this.nextId += 1;
    const line: LogLine = {
      id: this.nextId,
      // El espacio se imprime con nombre; si no, no se vería nada.
      key: event.key === ' ' ? 'Space' : event.key,
      outcome: event.outcome,
      action: event.action,
    };
    this.log.update((lines) => [line, ...lines].slice(0, LOG_LENGTH));
  }
}
