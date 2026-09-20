import type { IconName } from '@ewms/design-system';

/**
 * One entry of the application's menu, BEFORE it is translated.
 *
 * `labelKey` and not `label`: this file is a structure, and the words for it
 * live in the dictionaries. The shell turns this into `NavItem[]` at render
 * time, which is why changing language redraws the menu without a reload.
 */
export interface MenuEntry {
  readonly id: string;
  readonly labelKey: string;
  readonly icon: IconName;
  /** Absent on a group. */
  readonly route?: string;
  readonly children?: readonly MenuEntry[];
}

/**
 * THE MENU OF THE APPLICATION, STATIC, IN ONE FILE.
 *
 * Static because there is nothing to ask. The menu a user sees will one day
 * depend on their permissions, and permissions come from the Security Core
 * (PLN-WMS-005, Sprint 1) which does not exist. Building a menu service that
 * fetches from nowhere would be inventing a contract; building the tree the
 * design actually specifies is not.
 *
 * It lives in the SHELL and not in the design system, which is the line
 * `Navegacion.md` draws: the pieces do not know the real menu, the permissions
 * or the router, and this is all three.
 *
 * ONLY TWO ENTRIES HAVE A REAL SCREEN TODAY -- Dashboard and the design
 * system. THE OTHER THIRTEEN GO TO «En construcción», WHICH IS A PAGE WITH A
 * TITLE AND AN `h1`, NEVER A 404. A menu entry that 404s tells the operator the
 * application is broken; one that says "this is not built yet" tells them the
 * truth, and it keeps the shape of the navigation honest while the domains
 * arrive in DS-6.
 */
/*
 * THE KEYS, SPELLED OUT FOR THE EXTRACTOR.
 *
 * `transloco-keys-manager` finds keys written as literals in a template or in
 * a `translate('...')` call. The menu's labels reach `translate` through
 * `entry.labelKey`, which is DATA, so the extractor sees nothing and gate 12
 * reports seventeen dictionary entries "used nowhere" -- a correct complaint
 * about a genuinely dead key, and a false one here.
 *
 * The marker below is the convention i18n.md gives for exactly this case. It
 * has to be a doc comment holding ONE marker call on ONE line, which is why it
 * is long rather than wrapped: the extractor splits on commas, so a `*` from a
 * continuation line would become part of a key. Writing an example of the
 * marker in prose would also register whatever is inside it as a key -- which
 * is how this comment first broke the gate it exists to explain.
 *
 * It is not a second list to maintain. Every key in it also appears in `MENU`
 * immediately underneath, and one that fell out of either side fails the gate
 * from the other.
 */
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

/** Every destination in the tree, flattened. Used to resolve the active item. */
export const MENU_DESTINATIONS: readonly MenuEntry[] = MENU.flatMap((entry) =>
  entry.children === undefined ? [entry] : entry.children,
).filter((entry) => entry.route !== undefined);

/**
 * The entries that have no screen yet.
 *
 * Derived rather than listed, so a route built in DS-6 stops being "under
 * construction" by being given a component and nothing else.
 */
export const BUILT_ROUTES: readonly string[] = ['/', '/design-system'];
