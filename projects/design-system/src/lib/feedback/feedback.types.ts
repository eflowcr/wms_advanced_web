import type { IconName } from '../../icons/icons.generated';
import type { IconSize } from '../icon/icon';

/**
 * Severidad común de Banner y Toast. Info se pinta neutral: un azul informativo medía 1.76:1
 * contra el de acción. Ver vault: Notificaciones.
 */
export type FeedbackVariant = 'success' | 'warning' | 'danger' | 'info';

/** Con lo que pinta tokens.css; difiere de `FeedbackVariant` solo en info -> neutral. */
export type SemanticFamily = 'success' | 'warning' | 'danger' | 'neutral';

/** Único lugar que traduce variante a familia. */
export const FEEDBACK_FAMILIES: Readonly<Record<FeedbackVariant, SemanticFamily>> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'neutral',
};

/** Clases escritas enteras: Tailwind escanea texto crudo y no ve una armada con plantilla. */
export function familyBoxClasses(family: SemanticFamily): string {
  switch (family) {
    case 'success':
      return 'bg-success-surface border-success text-success';
    case 'warning':
      return 'bg-warning-surface border-warning text-warning';
    case 'danger':
      return 'bg-danger-surface border-danger text-danger';
    case 'neutral':
      return 'bg-neutral-surface border-neutral text-neutral';
  }
}

/** Solo el tinte, para una fila de tabla: con el frente de color el SKU se leería peor. */
export function familyTintClass(family: SemanticFamily): string {
  switch (family) {
    case 'success':
      return 'bg-success-surface';
    case 'warning':
      return 'bg-warning-surface';
    case 'danger':
      return 'bg-danger-surface';
    case 'neutral':
      return 'bg-neutral-surface';
  }
}

/** Los mismos cuatro dibujos en Banner, Toast y tabla. */
export function familyIcon(family: SemanticFamily): IconName {
  switch (family) {
    case 'success':
      return 'circle-check';
    case 'warning':
      return 'alert-triangle';
    case 'danger':
      return 'circle-x';
    case 'neutral':
      return 'info-circle';
  }
}

/** Lo elige el componente, nunca el consumidor: evita un triángulo sobre un éxito. */
export const FEEDBACK_ICONS: Readonly<Record<FeedbackVariant, IconName>> = {
  success: familyIcon('success'),
  warning: familyIcon('warning'),
  danger: familyIcon('danger'),
  info: familyIcon('neutral'),
};

/** Danger y Warning interrumpen (`alert`); el resto espera su turno. Ver vault: Notificaciones. */
export function feedbackRole(variant: FeedbackVariant): 'alert' | 'status' {
  return variant === 'danger' || variant === 'warning' ? 'alert' : 'status';
}

/** Frente `-text` (5.58 / 5.34 / 5.34 / 9.04 sobre su superficie). Ver vault: Notificaciones. */
export function feedbackSurfaceClasses(variant: FeedbackVariant): string {
  return familyBoxClasses(FEEDBACK_FAMILIES[variant]);
}

/** Acento en `-solid` (3.71 a 4.28:1): `-border` no pasa de 1.62. Ver vault: Notificaciones. */
export function feedbackAccentClasses(variant: FeedbackVariant): string {
  switch (variant) {
    case 'success':
      return 'bg-success-solid';
    case 'warning':
      return 'bg-warning-solid';
    case 'danger':
      return 'bg-danger-solid';
    case 'info':
      return 'bg-neutral-solid';
  }
}

/** 18 px: se lee como símbolo y no grita en un toast. */
export const FEEDBACK_ICON_SIZE: IconSize = 'md';
