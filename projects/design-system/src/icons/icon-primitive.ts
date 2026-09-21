/**
 * La geometría de un icono, como dato. icons.generated.ts es una tabla de estos: la
 * plantilla de `<ewms-icon>` recorre la lista y ata `d`, así que un icono nunca
 * llega al DOM como marcado. Los atributos de presentación están ausentes a
 * propósito: los pone el componente una vez sobre el `<svg>`.
 * Solo `<path>` (ADR 0011): Tabler entrega todo como paths y la tarima propia
 * también. Un tipo de elemento es una rama de plantilla y nada que ningún icono use.
 */
export interface IconPath {
  readonly type: 'path';
  readonly d: string;
}

export type IconPrimitive = IconPath;
