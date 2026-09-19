import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Button } from '../button/button';
import { Toggle } from '../toggle/toggle';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import {
  isSingleCharacter,
  type ShortcutAction,
  type ShortcutBinding,
  type ShortcutHelpMessages,
} from './shortcuts.types';

/** The id the heading carries, so the CDK container can point `aria-labelledby` at it. */
export const SHORTCUT_HELP_TITLE_ID = 'ewms-shortcut-help-title';

/** One row of the table: an action, what it does, and how it is written. */
interface HelpRow {
  readonly action: ShortcutAction;
  readonly description: string;
  readonly chord: readonly string[];
  /** Whether this one goes quiet when the 2.1.4 switch is off. */
  readonly singleKey: boolean;
}

/**
 * WHAT `?` OPENS (RFE-07), AND THE SWITCH WCAG 2.2 ASKS FOR (RFE-09).
 *
 * THE LIST IS NEVER WRITTEN TWICE. This component reads `EWMS_SHORTCUT_MAP`
 * -- the same object the engine dispatches from -- so a shortcut added to the
 * map appears here without anybody touching this file. What the application
 * provides separately is one LABEL per action, because the library speaks no
 * language (ADR 0008); the keys come from the map.
 *
 *
 * THE SWITCH IS NOT A SETTING SOMEBODY ASKED FOR
 *
 * WCAG 2.2 success criterion 2.1.4, Character Key Shortcuts, says that a
 * shortcut which is a single printable character must be switchable off or
 * remappable. RFE-04 -- no shortcut inside a text field -- does not satisfy
 * it: 2.1.4 exists for people using speech input, whose words become
 * characters wherever the focus happens to be, and for anyone whose switch or
 * head-pointer emits stray keys. `/` and `?` are exactly that class of
 * shortcut, so they get the switch. It was a finding against REQ-FE-DS4-001
 * v1.0, which did not have it, and is RFE-09 of v1.1.
 *
 * It lives in memory for as long as the tab does. Remembering it needs a place
 * to keep a preference per user, which needs the backend's Security Core
 * (PLN-WMS-005, Sprint 1) -- the dependency that also defers favourites.
 */
@Component({
  selector: 'ewms-shortcut-help',
  templateUrl: './shortcut-help.html',
  imports: [Button, Toggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class ShortcutHelp {
  private readonly dialogRef = inject<DialogRef<void>>(DialogRef);
  private readonly shortcuts = inject(KeyboardShortcuts);

  protected readonly titleId = SHORTCUT_HELP_TITLE_ID;
  protected readonly singleKeyShortcuts = this.shortcuts.singleKeyShortcuts;

  /**
   * THE MAP AND THE WORDS COME FROM THE ENGINE, not from the two injection
   * tokens directly, and the reason is not style.
   *
   * A dialog is created by the CDK against the injector it was given, which is
   * the environment one -- and both tokens are provided on a root layout
   * COMPONENT, in an element injector below it. Injecting them here would find
   * nothing. Reading them off `KeyboardShortcuts` also means this dialog can
   * only ever show the map that is really dispatching, which for a list whose
   * whole job is to be true is the stronger guarantee.
   *
   * Non-null by construction: the dialog is opened by the host, and the host
   * mounted the map before it registered the action that opens this.
   */
  protected readonly messages = computed<ShortcutHelpMessages | null>(() =>
    this.shortcuts.helpMessages(),
  );

  /**
   * The map, in the order it was written.
   *
   * Insertion order and not alphabetical: the map lists the four working
   * actions in the order somebody meets them -- find, create, save, cancel --
   * and sorting by the Spanish or English name would scramble that differently
   * per language.
   */
  protected readonly rows = computed<readonly HelpRow[]>(() => {
    const messages = this.messages();
    const entries = Object.entries(this.shortcuts.bindings() ?? {}) as readonly (readonly [
      ShortcutAction,
      ShortcutBinding,
    ])[];
    return entries.map(([action, binding]) => ({
      action,
      description: messages?.actions[action] ?? action,
      chord: binding.chord,
      singleKey: isSingleCharacter(binding),
    }));
  });

  /** Whether any shortcut at all is affected by the switch. */
  protected readonly hasSingleKey = computed(() => this.rows().some((row) => row.singleKey));

  protected toggleSingleKey(enabled: boolean): void {
    this.shortcuts.singleKeyShortcuts.set(enabled);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
