import type { IconName } from '../../icons/icons.generated';

/** Una entrada de menú: la del menú de fila de la Tabla y la del split button. */
export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconName;
  /** Lo pinta como respuesta destructiva. */
  readonly tone?: 'danger';
  readonly separatorBefore?: boolean;
  readonly disabled?: boolean;
}
