import { CdkDialogContainer } from '@angular/cdk/dialog';
import { CdkPortalOutlet } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/*
 * El contenedor del CDK trae una hoja de componente, y la CSP estricta la bloquea al abrirse el
 * primer diálogo (ADR 0010, el mismo motivo por el que acá nadie abre una hoja). Este repite su
 * plantilla con esas cinco reglas como utilidades; el resto —foco, rol, portal— es el de arriba.
 */
@Component({
  selector: 'ewms-dialog-container',
  template: '<ng-template cdkPortalOutlet />',
  imports: [CdkPortalOutlet],
  host: { class: 'cdk-dialog-container block h-full w-full min-h-[inherit] max-h-[inherit]' },
  encapsulation: ViewEncapsulation.None,
  // El del CDK es Eager por su cola de `aria-labelledby`; acá el texto llega por configuración.
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogContainer extends CdkDialogContainer {}
