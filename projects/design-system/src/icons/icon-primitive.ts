/**
 * Geometría como dato: la plantilla ata `d` y un icono nunca llega como marcado. Solo `<path>`
 * (ADR 0011): es todo lo que entregan Tabler y los propios. La presentación va en el `<svg>`.
 */
export interface IconPath {
  readonly type: 'path';
  readonly d: string;
}

export type IconPrimitive = IconPath;
