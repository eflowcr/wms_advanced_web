import type { IconName } from '../../icons/icons.generated';

/**
 * Las formas que reciben las piezas de navegación, y la raya que no cruzan:
 * ninguna lleva un objeto de ruta, un permiso ni un componente. `route` es una
 * cadena porque las piezas nunca navegan: emiten lo elegido y navega el shell.
 * Una pieza que importara `@angular/router` no se podría mostrar en el showroom
 * sin router ni reutilizar en otra aplicación con otro árbol de rutas.
 */

/**
 * Una entrada del árbol. Con `children` es un GRUPO: no es destino, abre. Sin
 * ellos es un destino. Nada más los distingue, y nada puede: un grupo que además
 * fuera enlace haría que «qué hace este clic» dependa de dónde clickeaste.
 */
export interface NavItem {
  /** Estable entre pintados. Es el idioma de `activeId` y de `itemSelect`. */
  readonly id: string;
  /** Ya traducida por el consumidor (ADR 0008). */
  readonly label: string;
  readonly icon: IconName;
  /** Adónde va, para que lo interprete el consumidor. Ausente en un grupo. Una
   * cadena a propósito: los tipos de `Router` arrastrarían el router acá. */
  readonly route?: string;
  /** Presente en un grupo, ausente en un destino. Nunca un arreglo vacío. */
  readonly children?: readonly NavItem[];
  /** Una cuenta chica al lado de la etiqueta: tareas pendientes, alertas. */
  readonly badge?: number;
}

/** Una pestaña de documento. */
export interface Tab {
  readonly id: string;
  /** Ya traducida por el consumidor. */
  readonly label: string;
  /** Si lleva control de cierre. Por defecto se cierra: una que no se puede
   * cerrar es la excepción, y la excepción es lo que se escribe. */
  readonly closable?: boolean;
  readonly disabled?: boolean;
}

/** Un paso del rastro de migas. El último es la página actual. */
export interface Crumb {
  /** Ya traducida por el consumidor. */
  readonly label: string;
  /** Ausente en la última miga, que es donde ya estás. */
  readonly route?: string;
}

/**
 * Hasta dónde camina el rastro antes de plegar el medio. Cinco, por el caso que
 * nombra la ficha: «Inicio / … / Ubicación A1-12-03». Hasta cuatro pasos entran
 * en una línea al ancho más angosto y se leen como un camino; más allá, el rastro
 * se parte y deja de serlo.
 */
export const CRUMB_FOLD_THRESHOLD = 5;

/** Si un item es un grupo: abre en vez de ir a ningún lado. */
export function isGroup(item: NavItem): boolean {
  return (item.children?.length ?? 0) > 0;
}

/**
 * El árbol aplanado en orden visual, respetando lo abierto. El foco móvil de un
 * treeview se mueve entre filas VISIBLES, así que camina esta lista y no el árbol.
 * Escrita una vez: el rail y la barra inferior dibujan el mismo árbol y tienen
 * que coincidir en qué es «el siguiente».
 */
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

/** El grupo que contiene a `id`, o null si es de primer nivel o no existe. */
export function parentOf(items: readonly NavItem[], id: string): NavItem | null {
  for (const item of items) {
    if (item.children?.some((child) => child.id === id) === true) {
      return item;
    }
  }
  return null;
}

/**
 * Qué migas se dibujan y cuáles esconde el pliegue. La primera y la última nunca
 * se esconden: la primera es de dónde venís y la última dónde estás, y un rastro
 * que esconda cualquiera de las dos dejó de ser un rastro.
 */
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
