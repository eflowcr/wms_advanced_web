import { InjectionToken } from '@angular/core';
import type { IconName } from '../../icons/icons.generated';

/** Una alternativa del menú. Mismo formato que el menú de fila de la Tabla, sin tono ni separador. */
export interface SplitAction {
  readonly id: string;
  /** Ya traducida (ADR 0008). */
  readonly label: string;
  readonly icon?: IconName;
  readonly disabled?: boolean;
}

/** Nombre del disparador del menú: el mismo en toda la aplicación, así que va por token. */
export interface SplitButtonMessages {
  readonly moreActions: string;
}

export const EWMS_SPLIT_BUTTON_MESSAGES = new InjectionToken<SplitButtonMessages>(
  'EWMS_SPLIT_BUTTON_MESSAGES',
);

/** Pega los dos botones: esquinas interiores rectas y un solo borde entre ellos. */
export const SPLIT_MAIN_CLASSES = 'inline-flex [&_button]:rounded-r-none';
export const SPLIT_TRIGGER_CLASSES = 'inline-flex [&_button]:rounded-l-none [&_button]:border-l-0';
