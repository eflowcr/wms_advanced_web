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

/** El id del encabezado, para que el contenedor del CDK apunte su `aria-labelledby`. */
export const SHORTCUT_HELP_TITLE_ID = 'ewms-shortcut-help-title';

/** Una fila de la tabla: una acción, qué hace y cómo se escribe. */
interface HelpRow {
  readonly action: ShortcutAction;
  readonly description: string;
  readonly chord: readonly string[];
  /** Si esta se calla cuando el conmutador de 2.1.4 está apagado. */
  readonly singleKey: boolean;
}

/**
 * Qué abre `?` (RFE-07) y el conmutador que pide WCAG 2.2 (RFE-09).
 *
 * LA LISTA NUNCA SE ESCRIBE DOS VECES: este componente lee `EWMS_SHORTCUT_MAP`,
 * el mismo objeto desde el que despacha el motor, así que un atajo agregado al
 * mapa aparece acá sin tocar este archivo. La aplicación provee una ETIQUETA por
 * acción, porque la librería no habla ningún idioma (ADR 0008).
 * El conmutador no es una preferencia que alguien pidió: WCAG 2.2 2.1.4 exige
 * poder apagar un atajo de un solo carácter imprimible, y RFE-04 no alcanza
 * porque 2.1.4 existe para quien usa entrada por voz. Vive en memoria hasta que
 * haya Security Core.
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
   * EL MAPA Y LAS PALABRAS VIENEN DEL MOTOR y no de los dos tokens: un diálogo lo
   * crea el CDK contra el inyector de entorno, y los dos tokens los provee un
   * COMPONENTE de layout raíz, en un inyector de elemento de más abajo -inyectarlos
   * acá no encontraría nada-. Leerlos del motor garantiza además que este diálogo
   * solo pueda mostrar el mapa que de verdad está despachando.
   */
  protected readonly messages = computed<ShortcutHelpMessages | null>(() =>
    this.shortcuts.helpMessages(),
  );

  /**
   * El mapa, en el orden en que se escribió. De inserción y no alfabético: el mapa
   * lista las cuatro acciones en el orden en que alguien las encuentra -buscar,
   * crear, guardar, cancelar- y ordenar por nombre lo desordenaría distinto en
   * cada idioma.
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

  /** Si algún atajo se ve afectado por el conmutador. */
  protected readonly hasSingleKey = computed(() => this.rows().some((row) => row.singleKey));

  protected toggleSingleKey(enabled: boolean): void {
    this.shortcuts.singleKeyShortcuts.set(enabled);
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
