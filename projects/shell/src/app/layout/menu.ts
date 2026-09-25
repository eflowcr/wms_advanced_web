import type { IconName } from '@ewms/design-system';

/** Entrada del menú sin traducir: `labelKey` y no `label`, las palabras son del diccionario. */
export interface MenuEntry {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: IconName;
  /** Ausente en un grupo. */
  readonly route?: string;
  readonly children?: readonly MenuEntry[];
}

/**
 * Menú estático: el real dependerá de permisos del Security Core (PLN-WMS-005), que no existe.
 * Solo Dashboard y el design system tienen pantalla; las otras trece van a «En construcción»,
 * nunca a un 404. Ver vault: 08-Sistema-de-Diseno/Componentes/App-Shell.
 */
// El marcador de abajo declara las claves al extractor, que no ve `entry.labelKey`. Va en una
// sola línea (parte por comas: un `*` de continuación entraría en la clave), y citarlo en prosa
// también registra claves. Si una clave falta de un lado, la compuerta 12 falla.
/** t(shell.menu.dashboard, shell.menu.catalogs, shell.menu.articles, shell.menu.clients, shell.menu.suppliers, shell.menu.locations, shell.menu.warehouses, shell.menu.units, shell.menu.lots, shell.menu.serials, shell.menu.carriers, shell.menu.rates, shell.menu.settings, shell.menu.users, shell.menu.profiles, shell.menu.params, shell.menu.designSystem) */
export const MENU: readonly MenuEntry[] = [
  { id: 'dashboard', labelKey: 'shell.menu.dashboard', icon: 'dashboard', route: '/' },
  {
    id: 'catalogs',
    labelKey: 'shell.menu.catalogs',
    icon: 'inventory',
    children: [
      {
        id: 'articles',
        labelKey: 'shell.menu.articles',
        icon: 'package',
        route: '/catalogos/articulos',
      },
      {
        id: 'clients',
        labelKey: 'shell.menu.clients',
        icon: 'operator',
        route: '/catalogos/clientes',
      },
      {
        id: 'suppliers',
        labelKey: 'shell.menu.suppliers',
        icon: 'dock',
        route: '/catalogos/proveedores',
      },
      {
        id: 'locations',
        labelKey: 'shell.menu.locations',
        icon: 'location',
        route: '/catalogos/ubicaciones',
      },
      {
        id: 'warehouses',
        labelKey: 'shell.menu.warehouses',
        icon: 'warehouse',
        route: '/catalogos/almacenes',
      },
      { id: 'units', labelKey: 'shell.menu.units', icon: 'weight', route: '/catalogos/unidades' },
      { id: 'lots', labelKey: 'shell.menu.lots', icon: 'lot', route: '/catalogos/lotes' },
      { id: 'serials', labelKey: 'shell.menu.serials', icon: 'serial', route: '/catalogos/series' },
      {
        id: 'carriers',
        labelKey: 'shell.menu.carriers',
        icon: 'shipment',
        route: '/catalogos/transportistas',
      },
      { id: 'rates', labelKey: 'shell.menu.rates', icon: 'order', route: '/catalogos/tarifas' },
    ],
  },
  {
    id: 'settings',
    labelKey: 'shell.menu.settings',
    icon: 'settings',
    children: [
      {
        id: 'users',
        labelKey: 'shell.menu.users',
        icon: 'operator',
        route: '/configuracion/usuarios',
      },
      {
        id: 'profiles',
        labelKey: 'shell.menu.profiles',
        icon: 'crew',
        route: '/configuracion/perfiles',
      },
      {
        id: 'params',
        labelKey: 'shell.menu.params',
        icon: 'controls',
        route: '/configuracion/parametros',
      },
    ],
  },
  {
    id: 'design-system',
    labelKey: 'shell.menu.designSystem',
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
export const BUILT_ROUTES: readonly string[] = ['/', '/design-system'];
