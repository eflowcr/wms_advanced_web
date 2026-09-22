import type { IconName } from '../../icons/icons.generated';

/** Tonos de confirmación. `info` se pinta neutral: el azul es solo acción. Ver vault: Modal. */
export type DialogTone = 'danger' | 'warning' | 'info';

/** Lo que toma `DialogService.confirm`. Todo texto ya traducido (ADR 0008). */
export interface ConfirmOptions {
  readonly title: string;
  readonly body: string;
  readonly tone: DialogTone;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

/** Opciones más los ids que acuña el servicio: el CDK los necesita antes de abrir. Interno. */
export interface ConfirmDialogData extends ConfirmOptions {
  readonly titleId: string;
  readonly bodyId: string;
}

/**
 * Fricción deliberada: el fondo no descarta un destructivo. Escape cierra los tres
 * siempre: tragarlo sería una trampa de teclado (WCAG 2.1.2). Ver vault: Modal.
 */
export function backdropDismisses(tone: DialogTone): boolean {
  return tone !== 'danger';
}

/** Glifo del catálogo en el color de la familia, sin fondo ni sombra (Modal v1.2, 2026-09-21). */
export function dialogIcon(tone: DialogTone): { readonly name: IconName; readonly color: string } {
  switch (tone) {
    case 'danger':
      return { name: 'alert-triangle', color: 'text-danger' };
    case 'warning':
      return { name: 'alert-triangle', color: 'text-warning' };
    case 'info':
      return { name: 'info-circle', color: 'text-neutral' };
  }
}

/** Danger para lo destructivo, Primary para el resto. Cancelar siempre es Secondary. */
export function confirmButtonVariant(tone: DialogTone): 'danger' | 'primary' {
  return tone === 'danger' ? 'danger' : 'primary';
}

/**
 * Ancho de la escala de 4 px (120 x 4 = 480), no de la escala de contenedores que ADR 0009
 * borra: compilaría sin aplicar nada. Su nombre no va ni en comentarios: la compuerta 10 lee
 * como clase toda tirada entre acentos graves de un .ts (ya rompió la build).
 */
export const DIALOG_BOX_CLASSES =
  'flex w-full max-w-120 flex-col gap-4 bg-surface p-6 ' +
  'rounded-dialog shadow-dialog border border-default border-solid';

/** Navy al 50 % con desenfoque: navy y no negro, como toda capa del sistema. */
export const DIALOG_BACKDROP_CLASSES = ['bg-overlay', 'backdrop-blur-dialog'];

export const DIALOG_PANEL_CLASSES = ['flex', 'max-w-full', 'p-4'];
