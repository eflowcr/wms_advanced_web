import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  createEnvironmentInjector,
  inject,
  signal,
  type EnvironmentInjector,
} from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { provideEwmsLocale } from '@ewms/core/locale';
import { Button, DialogService, FormPattern, Input } from '@ewms/design-system';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideEwmsDesignSystem } from '../design-system.providers';
import { SECOND_FACTOR } from './second-factor.token';

/**
 * Diálogo genérico de segundo factor ante el desafío de RFC 9470: no supone el tipo; el
 * adaptador pide y valida. Validado cierra con `true`; cancelar, con `false` (ADR 0026).
 */
@Component({
  selector: 'app-step-up-dialog',
  imports: [Button, FormField, FormPattern, Input, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './step-up-dialog.html',
  host: { class: 'contents' },
})
export class StepUpDialog {
  private readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly challenge = inject<string>(DIALOG_DATA);
  protected readonly factor = inject(SECOND_FACTOR);
  protected readonly titleId = 'app-step-up-title';
  protected readonly failed = signal(false);
  protected readonly model = signal({ value: '' });
  protected readonly stepUpForm = form(this.model, (path) => {
    if (this.factor.inputKey) required(path.value);
  });

  protected readonly verify = async (): Promise<void> => {
    this.failed.set(false);
    try {
      await this.factor.verify(this.model().value);
      this.ref.close(true);
    } catch {
      this.failed.set(true);
    }
  };

  protected cancel(): void {
    this.ref.close(false);
  }
}

/**
 * El interceptor ve la raíz; los textos y formatos de la consola se proveen en su ruta: el
 * diálogo los repone en su propio inyector. Resuelve si el factor quedó validado.
 */
export async function verifySecondFactor(
  parent: EnvironmentInjector,
  challenge: string,
): Promise<boolean> {
  const injector = createEnvironmentInjector(
    [provideEwmsLocale(), provideEwmsDesignSystem()],
    parent,
  );
  const ref = injector.get(DialogService).open<boolean, string, StepUpDialog>(StepUpDialog, {
    data: challenge,
    injector,
    dismissOnBackdrop: false,
    ariaLabelledBy: 'app-step-up-title',
  });
  try {
    return (await firstValueFrom(ref.closed)) === true;
  } finally {
    injector.destroy();
  }
}
