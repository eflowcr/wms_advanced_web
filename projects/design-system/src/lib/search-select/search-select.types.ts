import { InjectionToken } from '@angular/core';

/**
 * Los estados que una persona puede ver (RFE-03). `empty` Y `error` SON VALORES
 * DISTINTOS y el REQ es explícito: confundirlos hace que una caída del servicio
 * parezca un depósito vacío, que es la peor lectura posible en un depósito.
 */
export type SearchStatus =
  /** Nada tipeado todavía, o se vació el texto. */
  | 'idle'
  /** Hay una consulta en vuelo. */
  | 'searching'
  /** Hay resultados en pantalla. */
  | 'ready'
  /** La consulta volvió sin nada. NO es un error. */
  | 'empty'
  /** La fuente falló o se quedó sin tiempo. NO es ausencia de registros. */
  | 'error';

/** Los tokens que el componente lee en runtime. Ver lib/tokens/read-token.ts. */
export const DELAY_SEARCH_INPUT_TOKEN = '--delay-search-input';
export const TIMEOUT_SEARCH_TOKEN = '--timeout-search';

/*
 * El umbral de escaneo YA NO SE DECLARA ACÁ: vivía en este archivo cuando este
 * componente era lo único que medía una ráfaga. Una segunda copia es la deriva
 * que termina con un atajo disparando en medio de un escaneo. Se reexporta para
 * no obligar a los importadores a saber adónde se mudó.
 */
export { SCAN_MIN_KEYSTROKES, SCAN_THRESHOLD_TOKEN } from '../keyboard/scan-detector';

/**
 * Las filas que no son resultados: el spinner, la nota de vacío, «cargar más».
 * Comparten la geometría de un resultado para que la lista no salte, y van en
 * `text-secondary` porque ninguna es contenido: son la lista hablando de sí misma.
 */
export const SEARCH_NOTE_CLASSES =
  'flex items-center gap-2 px-3 py-1.5 text-caption text-secondary';

/**
 * La fila «cargar más». Es una FILA DE LA LISTA y no un botón al lado, y eso es
 * lo que la hace alcanzable con el teclado sin un tab stop propio: las flechas
 * caminan hasta ella. Un `<button>` en el panel necesitaría el foco, y el foco no
 * puede salir del campo.
 */
export const SEARCH_MORE_CLASSES =
  'flex w-full items-center justify-center gap-2 px-3 py-1.5 cursor-pointer text-caption ' +
  'text-(color:--color-bg-primary)';

/**
 * Los textos del selector, ya traducidos. PROVISTOS UNA VEZ, no pasados por
 * instancia: empezaron siendo una entrada obligatoria y se mudaron en DS-3 lote C,
 * cuando la Tabla necesitó lo mismo. La raya está en la nota Nomenclatura.
 */
export interface SearchSelectMessages {
  /** Mientras hay una consulta en vuelo. */
  readonly searching: string;
  /** Nada coincidió. Recibe el texto buscado, que RFE-03 exige mostrar. */
  readonly noResults: (query: string) => string;
  /** La fuente falló o se quedó sin tiempo. */
  readonly error: string;
  /** La etiqueta de la acción de reintentar. */
  readonly retry: string;
  /** La etiqueta de la fila «cargar más». */
  readonly more: string;
  /** Se anuncia cuando llegan resultados. Recibe cuántos hay y el total que
   * reportó la fuente, QUE PUEDE SER NULL: RFE-02 lo hace una respuesta legítima. */
  readonly results: (count: number, total: number | null) => string;
}

export const EWMS_SEARCH_SELECT_MESSAGES = new InjectionToken<SearchSelectMessages>(
  'EWMS_SEARCH_SELECT_MESSAGES',
);
