import { inject } from '@angular/core';
import { DialogService } from '../dialog/dialog.service';
import type { ConfirmOptions } from '../dialog/dialog.types';

/** Lo mínimo que hace falta saber del formulario: si lo tocaron. */
interface Dirty {
  readonly dirty: boolean;
}

/**
 * Cambios sin guardar: `true` sale, `false` se queda. Para el `canDeactivate` del router, que lo
 * llama en contexto de inyección; el sistema de diseño no conoce el router, así que la ruta la
 * escribe quien la tiene. Ver vault: Patron-Formulario.
 */
export function confirmDiscard(form: Dirty, options: ConfirmOptions): Promise<boolean> | boolean {
  return form.dirty ? inject(DialogService).confirm(options) : true;
}
