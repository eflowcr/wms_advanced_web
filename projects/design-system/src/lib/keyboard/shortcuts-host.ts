import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, inject } from '@angular/core';
import { DialogService } from '../dialog/dialog.service';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { ShortcutHelp, SHORTCUT_HELP_TITLE_ID } from './shortcut-help';
import { EWMS_SHORTCUT_HELP_MESSAGES, EWMS_SHORTCUT_MAP } from './shortcuts.types';

/**
 * THE ONE KEYBOARD LISTENER OF THE APPLICATION (RFE-03).
 *
 * Written once, on the root layout, exactly as the comanda demands: *"in the
 * base navigation component, not as something each screen implements
 * separately"*. There is no second one anywhere, and that is checkable rather
 * than promised -- `shortcuts-host.spec.ts` greps the source for a global
 * `keydown` outside this folder and the search select's own field handler.
 *
 * `addEventListener` on the document rather than `@HostListener('document:…')`
 * so that removing it is explicit and this file says, in one place, both when
 * the listener starts and when it stops.
 *
 * NO NgZone ANYWHERE, and that is not an omission: this application runs
 * zoneless, so what schedules a render is a signal changing, not an event
 * firing. A handler that sets a signal updates the view; one that does not,
 * does not -- which is also why a barcode's forty keystrokes cost nothing.
 *
 * It registers `help` itself, because that is the one action belonging to the
 * engine rather than to a screen: every screen has it, and no screen should
 * have to remember to.
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
     * THE MAP IS INJECTED HERE, NOT IN THE SERVICE, and that is the reason
     * this is a directive on the layout rather than something the service
     * does to itself on startup.
     *
     * Each application provides `EWMS_SHORTCUT_MAP` on its root layout
     * COMPONENT -- the shell on `MainLayout`, the showroom on
     * `ShowroomLayout` -- which puts it in an element injector. A directive on
     * that same element is inside that chain; a `providedIn: 'root'` service
     * is above it and would find nothing. So the directive reads the map and
     * mounts it, and `KeyboardShortcuts` stays the one registry of handlers.
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
   * RFE-07: the list, read off the map, in a dialog that returns the focus.
   *
   * The CDK does the returning (`restoreFocus`, set in DialogService), which
   * is also why this dialog lives in the library and not in each application:
   * it is user interface, it needs `DialogService`, and a copy per application
   * would be the list of shortcuts written twice -- the one thing RFE-07
   * forbids.
   */
  private openHelp(): void {
    this.dialog.open<void, void, ShortcutHelp>(ShortcutHelp, {
      ariaLabelledBy: SHORTCUT_HELP_TITLE_ID,
      ariaLabel: this.messages.title,
    });
  }
}
