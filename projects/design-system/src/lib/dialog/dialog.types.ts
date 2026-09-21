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

/** Círculo de 56 px con aro y halo (`--shadow-halo-*`), sin glifo a propósito. Ver vault: Modal. */
export function dialogIconClasses(tone: DialogTone): string {
  switch (tone) {
    case 'danger':
      return 'bg-danger-surface border-danger shadow-(--shadow-halo-danger)';
    case 'warning':
      return 'bg-warning-surface border-warning shadow-(--shadow-halo-warning)';
    case 'info':
      return 'bg-neutral-surface border-neutral shadow-(--shadow-halo-neutral)';
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
  'flex w-full max-w-120 flex-col items-center gap-4 bg-surface p-6 text-center ' +
  'rounded-dialog shadow-dialog border border-default border-solid';

/** Navy al 50 % con desenfoque: navy y no negro, como toda capa del sistema. */
export const DIALOG_BACKDROP_CLASSES = ['bg-overlay', 'backdrop-blur-dialog'];

export const DIALOG_PANEL_CLASSES = ['flex', 'max-w-full', 'p-4'];
