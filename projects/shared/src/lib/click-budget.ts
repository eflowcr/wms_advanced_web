/*
 * Presupuesto de clics: única copia de las cifras de REQ-FE-DS4-003 §2.2 (HG-02). En `shared`
 * para que una pantalla de dominio lo herede (RFE-05); se cambia primero en el vault, luego acá.
 * Cómo se cuenta un clic (§2.1; con teclado, cero): ver vault: REQ-FE-DS4-003 - Minimo de clics.
 */

/** Encontrar un registro, desde cualquier pantalla. */
export const SEARCH_MAX_CLICKS = 2;

/** Crear un registro, desde la pantalla de su módulo. */
export const CREATE_MAX_CLICKS = 2;

/** Editar un registro, encontrarlo incluido: la búsqueda va adentro y el tercer clic edita. */
export const EDIT_MAX_CLICKS = 3;

/**
 * Cancelar lo que sea; con Escape, cero. Pedir confirmar la cancelación de algo no guardado gasta
 * el presupuesto.
 */
export const CANCEL_MAX_CLICKS = 1;

/** Abrir un favorito desde cualquier pantalla: el bloque va fijo en el menú (DS4-002 RFE-04). */
export const OPEN_FAVORITE_MAX_CLICKS = 1;

/** Flujos que cubre el estándar. */
export type FlowId = 'search' | 'create' | 'edit' | 'cancel' | 'favorite';
