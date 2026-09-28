import type { Signal } from '@angular/core';
import type { BadgeDescriptor, BadgeDictionary, SelectOption } from '@ewms/design-system';
import { translated } from '../../ui/translated';

/**
 * Demo de tres niveles (cabecera, línea, serie o lote). Un solo tipo de fila: codigo es la
 * expedición, el SKU o la serie según el nivel. Los registros están en shipments.fixtures.ts.
 * Ver vault: 08-Sistema-de-Diseno/Componentes/Tabla.
 */
export interface ShipmentRow {
  readonly id: string;
  readonly level: 'cabecera' | 'linea' | 'serie';
  readonly code: string;
  readonly customer: string;
  /** ISO 8601: ordena y filtra como cadena sin parsear. */
  readonly date: string;
  readonly packages: number;
  readonly status: ShipmentStatus;
  readonly children?: readonly ShipmentRow[];
}

export type ShipmentStatus = 'pendiente' | 'en-proceso' | 'completada' | 'con-incidencia';

/**
 * El color de cada estado es el que fijó la ficha Tabla; `label`, la clave de su nombre.
 * t(showroom.common.shipments.states.pending, showroom.common.shipments.states.inProgress,
 *   showroom.common.shipments.states.completed, showroom.common.shipments.states.withIssue)
 */
const STATUSES: Readonly<Record<ShipmentStatus, BadgeDescriptor>> = {
  'pendiente': { variant: 'neutral', label: 'showroom.common.shipments.states.pending' },
  'en-proceso': { variant: 'warning', label: 'showroom.common.shipments.states.inProgress' },
  'completada': { variant: 'success', label: 'showroom.common.shipments.states.completed' },
  'con-incidencia': { variant: 'danger', label: 'showroom.common.shipments.states.withIssue' },
};

/**
 * Único lugar donde un estado se vuelve color y palabra: el badge, el tinte de fila y los filtros
 * leen el mismo diccionario y no pueden discrepar. Sigue al idioma: el badge no habla ninguno.
 */
export function injectStatuses(): Signal<BadgeDictionary> {
  return translated((translate) => {
    const entries = Object.entries(STATUSES).map(([status, badge]) => [
      status,
      { variant: badge.variant, label: translate(badge.label) },
    ]);
    return Object.fromEntries(entries) as BadgeDictionary;
  });
}

/** Los mismos estados como opciones de un Select, con las mismas palabras que el badge. */
export function injectStatusOptions(): Signal<readonly SelectOption[]> {
  return translated((translate) =>
    Object.entries(STATUSES).map(([value, badge]) => ({ value, label: translate(badge.label) })),
  );
}
