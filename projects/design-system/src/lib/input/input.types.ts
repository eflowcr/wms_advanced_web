import type { FieldSize } from '../field/field.types';

export type InputType = 'text' | 'number' | 'password' | 'search' | 'textarea';

/** Relleno izquierdo con icono de prefijo: el del campo, más los 16 px del icono,
 * más 8 px de aire. 34 / 36 / 38, siguiendo la escala de relleno en vez de ser un
 * número plano, para que el cursor quede a la misma distancia del icono. */
export const PREFIX_PADDING_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'pl-8.5',
  md: 'pl-9',
  lg: 'pl-9.5',
};

/** Desplazamiento izquierdo de ese icono, que es exactamente el relleno horizontal
 * del campo: el icono se alinea con donde habría empezado el texto. */
export const PREFIX_ICON_OFFSET_CLASSES: Readonly<Record<FieldSize, string>> = {
  sm: 'left-2.5',
  md: 'left-3',
  lg: 'left-3.5',
};

/**
 * Relleno derecho con sufijo. Un solo valor para los tres tamaños, al revés que el
 * prefijo, porque el sufijo no es un icono: es un `ewms-icon-button`, y el más chico
 * que existe es un cuadrado de 32 px. Con 4 px de aire a cada lado son 40.
 */
export const SUFFIX_PADDING_CLASS = 'pr-10';
