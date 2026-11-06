import type { IconName } from '@ewms/design-system';
import { SCREEN_CATALOG } from '@ewms/core/security';

/** Entrada del menú sin traducir: `labelKey` y no `label`, las palabras son del diccionario. */
export interface MenuEntry {
  readonly id: string;
  readonly labelKey: string;
  /** Plegado, bajo el ícono, cuando la etiqueta no entra. Debe estar dentro de la etiqueta (WCAG 2.5.3). */
  readonly shortLabelKey?: string;
  readonly icon: IconName;
  /** Ausente en un grupo. */
  readonly route?: string;
  readonly children?: readonly MenuEntry[];
}

/** Destinos derivados del catálogo; el shell filtra por la autorización vigente. */
// El marcador de abajo declara las claves al extractor, que no ve `entry.labelKey`. Va en una
// sola línea (parte por comas: un `*` de continuación entraría en la clave), y citarlo en prosa
// también registra claves. Si una clave falta de un lado, la compuerta 12 falla.
/** t(shell.menu.dashboard, shell.menu.catalogs, shell.menu.articles, shell.menu.clients, shell.menu.suppliers, shell.menu.locations, shell.menu.warehouses, shell.menu.units, shell.menu.lots, shell.menu.serials, shell.menu.carriers, shell.menu.rates, shell.menu.settings, shell.menu.users, shell.menu.profiles, shell.menu.params, shell.menu.designSystem, shell.menu.short.settings, shell.menu.short.designSystem) */
function destination(id: string, icon: IconName): MenuEntry {
  const screen = SCREEN_CATALOG.find((entry) => entry.id === id)!;
  return { id, icon, labelKey: screen.labelKey, route: screen.route };
}

export const MENU: readonly MenuEntry[] = [
  destination('dashboard', 'dashboard'),
  {
    id: 'catalogs',
    labelKey: 'shell.menu.catalogs',
    icon: 'inventory',
    children: [
      destination('articles', 'package'),
      destination('clients', 'operator'),
      destination('suppliers', 'dock'),
      destination('locations', 'location'),
      destination('warehouses', 'warehouse'),
      destination('units', 'weight'),
      destination('lots', 'lot'),
      destination('serials', 'serial'),
      destination('carriers', 'shipment'),
      destination('rates', 'order'),
    ],
  },
  {
    id: 'settings',
    labelKey: 'shell.menu.settings',
    shortLabelKey: 'shell.menu.short.settings',
    icon: 'settings',
    children: [
      destination('users', 'operator'),
      destination('profiles', 'crew'),
      destination('params', 'controls'),
    ],
  },
  {
    id: 'design-system',
    labelKey: 'shell.menu.designSystem',
    shortLabelKey: 'shell.menu.short.designSystem',
    icon: 'controls',
    route: '/design-system',
  },
];


/** Todos los destinos del árbol, aplanados. */
export const MENU_DESTINATIONS: readonly MenuEntry[] = MENU.flatMap((entry) =>
  entry.children === undefined ? [entry] : entry.children,
).filter((entry) => entry.route !== undefined);

/** `/articulos` coincide con `/articulos` y `/articulos/7`, nunca con `/articulos-x`. */
export function routeMatches(url: string, route: string | undefined): boolean {
  if (route === undefined) {
    return false;
  }
  if (route === '/') {
    return url === '/' || url.startsWith('/?');
  }
  return url === route || url.startsWith(`${route}/`) || url.startsWith(`${route}?`);
}

/**
 * La ruta más larga que coincide. Acá y no en `MainLayout` porque favoritos pregunta lo
 * mismo: dos copias darían nombres distintos a la pestaña y al favorito de una pantalla.
 */
export function menuEntryFor(url: string): MenuEntry | undefined {
  // Sin ruta no pasa el filtro: routeMatches ya descartó las entradas de grupo.
  return MENU_DESTINATIONS.filter((entry) => routeMatches(url, entry.route)).sort(
    (a, b) => b.route!.length - a.route!.length,
  )[0];
}

/** Rutas con pantalla; el resto del menú se deriva a «En construcción» en app.routes.ts. */
export const BUILT_ROUTES: readonly string[] = SCREEN_CATALOG.filter((s) => s.status !== 'construction').map((s) => s.route);
