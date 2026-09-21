import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, inject } from '@angular/core';
import { DialogService } from '../dialog/dialog.service';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { ShortcutHelp, SHORTCUT_HELP_TITLE_ID } from './shortcut-help';
import { EWMS_SHORTCUT_HELP_MESSAGES, EWMS_SHORTCUT_MAP } from './shortcuts.types';

/**
 * EL ÚNICO LISTENER DE TECLADO DE LA APLICACIÓN (RFE-03), escrito una vez sobre el
 * layout raíz. No hay un segundo en ningún lado, y es comprobable:
 * `shortcuts-host.spec.ts` busca en el fuente un `keydown` global fuera de esta
 * carpeta y del campo del selector.
 * `addEventListener` sobre el documento y no `@HostListener`, para que este archivo
 * diga en un solo lugar cuándo empieza y cuándo termina el listener.
 * SIN NgZone: la aplicación es zoneless, así que lo que agenda un pintado es una
 * señal que cambia y no un evento -por eso las cuarenta teclas de un barcode no
 * cuestan nada-. Registra `help` él mismo: es la acción del motor y no de una
 * pantalla.
 */
@Directive({
  selector: '[ewmsShortcutsHost]',
})
export class ShortcutsHost {
  private readonly shortcuts = inject(KeyboardShortcuts);
  private readonly dialog = inject(DialogService);
  private readonly messages = inject(EWMS_SHORTCUT_HELP_MESSAGES);

  constructor() {
    /*
     * EL MAPA SE INYECTA ACÁ Y NO EN EL SERVICIO, y por eso esto es una directiva
     * sobre el layout: cada aplicación provee `EWMS_SHORTCUT_MAP` en su COMPONENTE
     * de layout raíz, o sea en un inyector de elemento. Una directiva sobre ese
     * mismo elemento está en esa cadena; un servicio `providedIn: 'root'` está por
     * encima y no encontraría nada.
     */
    this.shortcuts.mount(inject(EWMS_SHORTCUT_MAP), this.messages);

    const doc = inject(DOCUMENT);
    const onKeydown = (event: Event): void => {
      this.shortcuts.handle(event as KeyboardEvent);
    };

    doc.addEventListener('keydown', onKeydown);
    this.shortcuts.register('help', () => this.openHelp());

    inject(DestroyRef).onDestroy(() => {
      doc.removeEventListener('keydown', onKeydown);
      this.shortcuts.unmount();
    });
  }

  /**
   * RFE-07: la lista, leída del mapa, en un diálogo que devuelve el foco. Lo
   * devuelve el CDK, que es también por qué este diálogo vive en la librería: es
   * interfaz, necesita `DialogService`, y una copia por aplicación sería la lista
   * de atajos escrita dos veces.
   */
  private openHelp(): void {
    this.dialog.open<void, void, ShortcutHelp>(ShortcutHelp, {
      ariaLabelledBy: SHORTCUT_HELP_TITLE_ID,
      ariaLabel: this.messages.title,
    });
  }
}
