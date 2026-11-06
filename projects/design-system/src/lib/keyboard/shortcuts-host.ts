import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ErrorHandler, Injector, PendingTasks, inject } from '@angular/core';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { EWMS_SHORTCUT_HELP_MESSAGES, EWMS_SHORTCUT_MAP } from './shortcuts.types';

/**
 * El único listener de teclado de la aplicación (RFE-03), sobre el layout raíz; CI lo comprueba.
 * `addEventListener` y no `@HostListener`: alta y baja en un solo lugar. Zoneless, así que un
 * código de cuarenta teclas no agenda pintados. Ver vault: Atajos-de-Teclado.
 */
@Directive({
  selector: '[ewmsShortcutsHost]',
})
export class ShortcutsHost {
  private readonly shortcuts = inject(KeyboardShortcuts);
  private readonly injector = inject(Injector);
  private readonly errors = inject(ErrorHandler);
  private readonly lifetime = inject(DestroyRef);
  private opening = false;
  private readonly pending = inject(PendingTasks);
  private readonly messages = inject(EWMS_SHORTCUT_HELP_MESSAGES);

  constructor() {
    // El mapa se inyecta acá y no en el servicio: está en el inyector de elemento del
    // layout raíz, fuera del alcance de `providedIn: 'root'`. Ver vault: Atajos-de-Teclado.
    this.shortcuts.mount(inject(EWMS_SHORTCUT_MAP), this.messages);

    const doc = inject(DOCUMENT);
    const onKeydown = (event: Event): void => {
      this.shortcuts.handle(event as KeyboardEvent);
    };

    doc.addEventListener('keydown', onKeydown);
    this.shortcuts.register('help', () => {
      void this.pending.run(() =>
        this.openHelp().catch((error: unknown) => this.errors.handleError(error)),
      );
    });

    inject(DestroyRef).onDestroy(() => {
      doc.removeEventListener('keydown', onKeydown);
      this.shortcuts.unmount();
    });
  }

  /** RFE-07: el CDK devuelve el foco. Vive en la librería para no escribir la lista dos veces. */
  private async openHelp(): Promise<void> {
    if (this.opening) return;
    this.opening = true;
    try {
      const [{ DialogService }, { ShortcutHelp, SHORTCUT_HELP_TITLE_ID }] = await Promise.all([
        import('../dialog/dialog.service'),
        import('./shortcut-help'),
      ]);
      if (this.lifetime.destroyed) return;
      this.injector.get(DialogService).open(ShortcutHelp, {
        ariaLabelledBy: SHORTCUT_HELP_TITLE_ID,
        ariaLabel: this.messages.title,
      });
    } finally {
      this.opening = false;
    }
  }
}
