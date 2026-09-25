import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Button,
  DESIGN_SYSTEM_VERSION,
  Input,
  isSingleCharacter,
  KeyboardShortcuts,
  SCAN_MIN_KEYSTROKES,
  type ShortcutAction,
  type ShortcutEvent,
  type ShortcutOutcome,
} from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
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
/**
 * t(showroom.patternKeyboard.outcomes.alreadyHandled, showroom.patternKeyboard.outcomes.burst,
 *   showroom.patternKeyboard.outcomes.scan, showroom.patternKeyboard.outcomes.key,
 *   showroom.patternKeyboard.outcomes.inTextField, showroom.patternKeyboard.outcomes.singleKeyOff,
 *   showroom.patternKeyboard.outcomes.unregistered, showroom.patternKeyboard.outcomes.deferred,
 *   showroom.patternKeyboard.outcomes.shortcut)
 */
const OUTCOMES: Readonly<Record<ShortcutOutcome, string>> = {
  'already-handled': 'showroom.patternKeyboard.outcomes.alreadyHandled',
  burst: 'showroom.patternKeyboard.outcomes.burst',
  scan: 'showroom.patternKeyboard.outcomes.scan',
  key: 'showroom.patternKeyboard.outcomes.key',
  'in-text-field': 'showroom.patternKeyboard.outcomes.inTextField',
  'single-key-off': 'showroom.patternKeyboard.outcomes.singleKeyOff',
  unregistered: 'showroom.patternKeyboard.outcomes.unregistered',
  deferred: 'showroom.patternKeyboard.outcomes.deferred',
  shortcut: 'showroom.patternKeyboard.outcomes.shortcut',
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

/**
 * La directiva no tiene valor que tipar: su fila lleva la clase que se importa, y la
 * descripción dice que es una directiva.
 * t(showroom.patternKeyboard.props.register, showroom.patternKeyboard.props.isRegistered,
 *   showroom.patternKeyboard.props.singleKeyShortcuts, showroom.patternKeyboard.props.scans,
 *   showroom.patternKeyboard.props.events, showroom.patternKeyboard.props.bindings,
 *   showroom.patternKeyboard.props.host)
 */
const PROPS: readonly PropRow[] = [
  {
    name: 'register(action, handler)',
    type: '=> Unregister',
    default: '—',
    description: 'showroom.patternKeyboard.props.register',
  },
  {
    name: 'isRegistered(action)',
    type: '=> boolean',
    default: '—',
    description: 'showroom.patternKeyboard.props.isRegistered',
  },
  {
    name: 'singleKeyShortcuts',
    type: 'WritableSignal<boolean>',
    default: 'true',
    description: 'showroom.patternKeyboard.props.singleKeyShortcuts',
  },
  {
    name: 'scans',
    type: 'Observable<string>',
    default: '—',
    description: 'showroom.patternKeyboard.props.scans',
  },
  {
    name: 'events',
    type: 'Observable<ShortcutEvent>',
    default: '—',
    description: 'showroom.patternKeyboard.props.events',
  },
  {
    name: 'bindings',
    type: 'Signal<ShortcutMap | null>',
    default: 'null',
    description: 'showroom.patternKeyboard.props.bindings',
  },
  {
    name: '[ewmsShortcutsHost]',
    type: 'ShortcutsHost',
    default: '—',
    description: 'showroom.patternKeyboard.props.host',
  },
];

/**
 * t(showroom.patternKeyboard.anatomy.parts.scanThreshold,
 *   showroom.patternKeyboard.anatomy.parts.kbdBackground,
 *   showroom.patternKeyboard.anatomy.parts.kbdBorder,
 *   showroom.patternKeyboard.anatomy.parts.dialogRadius,
 *   showroom.patternKeyboard.anatomy.parts.dialogElevation)
 */
const ANATOMY = [
  {
    part: 'showroom.patternKeyboard.anatomy.parts.scanThreshold',
    token: '--threshold-scan-keystroke',
  },
  { part: 'showroom.patternKeyboard.anatomy.parts.kbdBackground', token: '--color-bg-secondary' },
  { part: 'showroom.patternKeyboard.anatomy.parts.kbdBorder', token: '--color-border-default' },
  { part: 'showroom.patternKeyboard.anatomy.parts.dialogRadius', token: '--radius-dialog' },
  { part: 'showroom.patternKeyboard.anatomy.parts.dialogElevation', token: '--shadow-dialog' },
] as const;

/**
 * t(showroom.patternKeyboard.demo.log.columns.key, showroom.patternKeyboard.demo.log.columns.action,
 *   showroom.patternKeyboard.demo.log.columns.outcome)
 */
const LOG_COLUMNS: readonly DocColumn[] = [
  { id: 'key', label: 'showroom.patternKeyboard.demo.log.columns.key' },
  { id: 'action', label: 'showroom.patternKeyboard.demo.log.columns.action' },
  { id: 'outcome', label: 'showroom.patternKeyboard.demo.log.columns.outcome' },
];

/**
 * t(showroom.patternKeyboard.variants.columns.action, showroom.patternKeyboard.variants.columns.chord,
 *   showroom.patternKeyboard.variants.columns.single, showroom.patternKeyboard.variants.columns.inside,
 *   showroom.patternKeyboard.variants.columns.registered)
 */
const BINDING_COLUMNS: readonly DocColumn[] = [
  { id: 'action', label: 'showroom.patternKeyboard.variants.columns.action' },
  { id: 'chord', label: 'showroom.patternKeyboard.variants.columns.chord' },
  { id: 'single', label: 'showroom.patternKeyboard.variants.columns.single' },
  { id: 'inside', label: 'showroom.patternKeyboard.variants.columns.inside' },
  { id: 'registered', label: 'showroom.patternKeyboard.variants.columns.registered' },
];

/**
 * t(showroom.patternKeyboard.states.columns.outcome, showroom.patternKeyboard.states.columns.meaning)
 */
const OUTCOME_COLUMNS: readonly DocColumn[] = [
  { id: 'outcome', label: 'showroom.patternKeyboard.states.columns.outcome' },
  { id: 'meaning', label: 'showroom.patternKeyboard.states.columns.meaning' },
];

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
  imports: [Button, Input, DemoFrame, DocTable, PropTable, Prose, TokenValue, TranslocoPipe],
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
  protected readonly logColumns = LOG_COLUMNS;
  protected readonly bindingColumns = BINDING_COLUMNS;
  protected readonly outcomeColumns = OUTCOME_COLUMNS;

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

  /** La clave de la frase del resultado; la plantilla la traduce. */
  protected meaningOf(outcome: ShortcutOutcome): string {
    return this.outcomes[outcome];
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
