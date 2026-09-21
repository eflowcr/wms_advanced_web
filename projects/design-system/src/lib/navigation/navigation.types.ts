import type { IconName } from '../../icons/icons.generated';

// Ninguna pieza de navegación lleva ruta, permiso ni componente: emiten y navega el shell.
// Ver vault: Navegacion (El contrato).

/** Con `children` es un grupo: abre, no navega. Nada más los distingue. */
export interface NavItem {
  /** Estable entre pintados: es el idioma de `activeId` e `itemSelect`. */
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  /** Ausente en un grupo. Cadena a propósito: los tipos de `Router` arrastrarían el router. */
  readonly route?: string;
  /** Nunca un arreglo vacío. */
  readonly children?: readonly NavItem[];
  /** Cuenta chica junto a la etiqueta: pendientes, alertas. */
  readonly badge?: number;
}

export interface Tab {
  readonly id: string;
  readonly label: string;
  /** Por defecto se cierra. */
  readonly closable?: boolean;
  readonly disabled?: boolean;
}

/** El último paso es la página actual. */
export interface Crumb {
  readonly label: string;
  readonly route?: string;
}

/** Desde cinco pasos se pliega el medio. Ver vault: Navegacion (breadcrumbs). */
export const CRUMB_FOLD_THRESHOLD = 5;

export function isGroup(item: NavItem): boolean {
  return (item.children?.length ?? 0) > 0;
}

/** Orden visual respetando lo abierto: rail y barra inferior coinciden en «el siguiente». */
export function visibleItems(
  items: readonly NavItem[],
  openGroups: ReadonlySet<string>,
): readonly NavItem[] {
  const flat: NavItem[] = [];
  for (const item of items) {
    flat.push(item);
    if (isGroup(item) && openGroups.has(item.id)) {
      flat.push(...(item.children ?? []));
    }
  }
  return flat;
}

export function parentOf(items: readonly NavItem[], id: string): NavItem | null {
  for (const item of items) {
    if (item.children?.some((child) => child.id === id) === true) {
      return item;
    }
  }
  return null;
}

/** La primera y la última miga nunca se pliegan. */
export function foldCrumbs(
  crumbs: readonly Crumb[],
  expanded: boolean,
): { readonly visible: readonly Crumb[]; readonly folded: number } {
  const first = crumbs[0];
  const last = crumbs[crumbs.length - 1];
  if (
    expanded ||
    crumbs.length < CRUMB_FOLD_THRESHOLD ||
    first === undefined ||
    last === undefined
  ) {
    return { visible: crumbs, folded: 0 };
  }
  return { visible: [first, last], folded: crumbs.length - 2 };
}
