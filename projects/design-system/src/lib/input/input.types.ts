import type { FieldSize } from '../field/field.types';

export type InputType = 'text' | 'number' | 'password' | 'search' | 'textarea';

/** Relleno del campo + 16 px de icono + 8 px de aire (34 / 36 / 38): cursor a igual distancia. */
export const PREFIX_PADDING_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'pl-8.5',
  md: 'pl-9',
  lg: 'pl-9.5',
};

/** Igual al relleno horizontal: el icono empieza donde empezaría el texto. */
export const PREFIX_ICON_OFFSET_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'left-2.5',
  md: 'left-3',
  lg: 'left-3.5',
};

/** Un valor para los tres tamaños: el sufijo es un botón de solo ícono de 32 px más 4 px por lado. */
export const SUFFIX_PADDING_CLASS = 'pr-10';
