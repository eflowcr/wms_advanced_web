import { InjectionToken } from '@angular/core';

/**
 * The global actions, BY NAME. A screen registers `create`; it never registers
 * `Alt+N` (REQ-FE-DS4-001 RFE-01).
 *
 * The list is closed on purpose. An open `string` would let two screens invent
 * `nuevo` and `new` for the same thing, which is the drift the whole map
 * exists to prevent, and the help dialog would have nothing to label them
 * with. Per-domain shortcuts arrive with the first vertical domain (DS-6) and
 * will extend this union, not escape it.
 */
export type ShortcutAction =
  /** Put the focus in the screen's search field. */
  | 'search'
  /** Start creating a new record. */
  | 'create'
  /** Save the active form. */
  | 'save'
  /** Cancel what is in progress, or close the open overlay. */
  | 'cancel'
  /** Open the list of shortcuts. */
  | 'help';

/**
 * One binding: which key, which modifiers, and the two behaviours that are
 * properties of the COMBINATION rather than opinions of the engine.
 *
 *
 * WHY `insideTextFields` AND `preventDefault` ARE DECLARED HERE
 *
 * RFE-04 has exactly one exception -- Escape -- and RFE-02 has exactly one
 * combination whose browser default has to go -- Ctrl+S. Written into the
 * engine, both would be a key name spelled somewhere other than the map, and
 * then the map is no longer the single place a key lives. Written here, the
 * engine stays generic and the map keeps its promise: changing Escape for
 * something else is editing one line of one file, and the help dialog updates
 * itself because it reads the same object.
 */
export interface ShortcutBinding {
  /** The `KeyboardEvent.key` value, exactly as the browser reports it. */
  readonly key: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  /**
   * Fires even with the focus inside a text field. RFE-04's single exception,
   * and it is not a convenience: half the time somebody wants to cancel, the
   * focus is inside the field they are filling in.
   */
  readonly insideTextFields?: boolean;
  /**
   * The browser's own answer to this combination must not run.
   *
   * Applied WHETHER OR NOT anybody registered the action, which is the point
   * for Ctrl+S: a half-finished page saved to disk is worse than nothing
   * happening.
   */
  readonly preventDefault?: boolean;
  /**
   * How the combination is written on screen, one `<kbd>` per element.
   *
   * Separate from `key` because the two genuinely differ: the key is `n` and
   * what a person reads is `N`, the key is `/` and the chord is `/`. Deriving
   * one from the other works until it does not, and the help dialog is the
   * only reader.
   */
  readonly chord: readonly string[];
}

/** Every action bound. A missing action is a compile error, not a silent gap. */
export type ShortcutMap = Readonly<Record<ShortcutAction, ShortcutBinding>>;

/**
 * THE MAP, PROVIDED ONCE PER APPLICATION.
 *
 * The library defines the shape and implements none of it, exactly like
 * `EWMS_TABLE_MESSAGES` and `EWMS_SEARCH_SELECT_MESSAGES` before it. The shell
 * provides its map from `shortcuts.map.ts`; the showroom provides its own for
 * the pattern pages. Each application therefore has ONE file that names keys,
 * which is what RFE-01 asks for, and the two applications are free to differ
 * -- the showroom is a catalogue, not a warehouse screen.
 */
export const EWMS_SHORTCUT_MAP = new InjectionToken<ShortcutMap>('EWMS_SHORTCUT_MAP');

/**
 * The words the help dialog puts on screen, already translated (ADR 0008).
 *
 * The design system speaks no language. The shell fills this from Transloco,
 * the showroom from Spanish literals, and neither of them repeats the list of
 * shortcuts: what is provided here is one label per ACTION, and the keys come
 * from the map. Adding a shortcut adds a line to the map and a label here, and
 * the dialog changes by itself (RFE-07).
 */
export interface ShortcutHelpMessages {
  readonly title: string;
  /** One sentence under the title, before the table. */
  readonly intro: string;
  readonly actionColumn: string;
  readonly keyColumn: string;
  readonly close: string;
  /** The label of the WCAG 2.1.4 switch. */
  readonly singleKeyLabel: string;
  /** Why the switch is there, in one sentence. */
  readonly singleKeyHint: string;
  /**
   * Shown beside a single-character shortcut while the switch is off.
   *
   * The row is not hidden: a shortcut that vanished would leave somebody
   * wondering whether they had imagined it, and the list is also how you find
   * out the switch is what silenced it.
   */
  readonly singleKeyOff: string;
  /** What each action does, in the reader's language. */
  readonly actions: Readonly<Record<ShortcutAction, string>>;
}

export const EWMS_SHORTCUT_HELP_MESSAGES = new InjectionToken<ShortcutHelpMessages>(
  'EWMS_SHORTCUT_HELP_MESSAGES',
);

/**
 * Whether this binding is a bare printable character -- `/` and `?` today.
 *
 * DERIVED AND NOT DECLARED, because it is a fact about the combination rather
 * than a decision somebody makes: a key that produces one character with no
 * modifier is one a person hits while doing something else, and one a barcode
 * gun can emit. WCAG 2.2 2.1.4 is about exactly this class of shortcut, and so
 * is the deferral the engine applies to it.
 */
export function isSingleCharacter(binding: ShortcutBinding): boolean {
  return binding.key.length === 1 && binding.ctrl !== true && binding.alt !== true;
}

/** Whether this keydown is the binding, modifiers included. */
export function matches(binding: ShortcutBinding, event: KeyboardEvent): boolean {
  return (
    event.key === binding.key &&
    event.ctrlKey === (binding.ctrl ?? false) &&
    event.altKey === (binding.alt ?? false) &&
    // Never claimed by a global shortcut: on macOS this is Command, and on
    // Windows it opens the system menu. Neither belongs to the application.
    !event.metaKey
  );
}
