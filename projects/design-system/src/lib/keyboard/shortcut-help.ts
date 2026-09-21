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

/** Para el `aria-labelledby` del contenedor del CDK. */
export const SHORTCUT_HELP_TITLE_ID = 'ewms-shortcut-help-title';

interface HelpRow {
  readonly action: ShortcutAction;
  readonly description: string;
  readonly chord: readonly string[];
  /** Se calla con el conmutador de 2.1.4 apagado. */
  readonly singleKey: boolean;
}

/**
 * Lo que abre `?` (RFE-07) y el conmutador de WCAG 2.2 2.1.4 (RFE-09). Lee el mismo mapa
 * que despacha el motor: la lista nunca se escribe dos veces. Ver vault: Atajos-de-Teclado.
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
   * Del motor y no de los tokens: el CDK crea el diálogo con el inyector de entorno, y los
   * tokens están en el inyector de elemento del layout raíz, donde no los encontraría.
   */
  protected readonly messages = computed<ShortcutHelpMessages | null>(() =>
    this.shortcuts.helpMessages(),
  );

  /** Orden de inserción, el del uso; alfabético cambiaría según el idioma. */
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

  protected readonly hasSingleKey = computed(() => this.rows().some((row) => row.singleKey));

  protected toggleSingleKey(enabled: boolean): void {
    this.shortcuts.singleKeyShortcuts.set(enabled);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
