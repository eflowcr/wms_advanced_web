import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  Breadcrumbs,
  DESIGN_SYSTEM_VERSION,
  NavBottom,
  NavRail,
  parentOf,
  Tabs,
  type Crumb,
  type NavItem,
  type Tab,
} from '@ewms/design-system';
import { DemoFrame } from '../../ui/demo-frame';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { TokenValue } from '../../ui/token-value';

/**
 * Árbol real del App Shell, recortado: un grupo con muchos hijos y otro con pocos
 * es la forma que complica la navegación; tres ítems planos no enseñarían nada.
 */
const TREE: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
  {
    id: 'catalogs',
    label: 'Catálogos',
    icon: 'inventory',
    children: [
      { id: 'articles', label: 'Artículos', icon: 'package', route: '/catalogos/articulos' },
      { id: 'clients', label: 'Clientes', icon: 'operator', route: '/catalogos/clientes' },
      { id: 'locations', label: 'Ubicaciones', icon: 'location', route: '/catalogos/ubicaciones' },
      { id: 'lots', label: 'Lotes', icon: 'lot', route: '/catalogos/lotes', badge: 4 },
    ],
  },
  {
    id: 'settings',
    label: 'Configuración',
    icon: 'settings',
    children: [
      { id: 'users', label: 'Usuarios', icon: 'operator', route: '/configuracion/usuarios' },
      { id: 'params', label: 'Parámetros', icon: 'controls', route: '/configuracion/parametros' },
    ],
  },
];

/** La raíz de la miga. Lo único del camino que no sale del árbol. */
const ROOT_CRUMB: Crumb = { label: 'Inicio', route: '#' };

/** Siete niveles: el caso que la ficha nombraba como pendiente de truncado. */
const DEEP_TRAIL: readonly Crumb[] = [
  { label: 'Inicio', route: '/' },
  { label: 'Almacenes', route: '/almacenes' },
  { label: 'CEDI ePRAC', route: '/almacenes/cedi' },
  { label: 'Zona A', route: '/almacenes/cedi/a' },
  { label: 'Pasillo 1', route: '/almacenes/cedi/a/1' },
  { label: 'Rack 12', route: '/almacenes/cedi/a/1/12' },
  { label: 'Ubicación A1-12-03' },
];

const RAIL_PROPS: readonly PropRow[] = [
  {
    name: 'items',
    type: 'readonly NavItem[]',
    default: '— (obligatorio)',
    description: 'El árbol. Un ítem con children es un grupo: abre, no navega.',
  },
  {
    name: 'label',
    type: 'string',
    default: '— (obligatorio)',
    description: 'El nombre del landmark, ya traducido. Obligatorio: una página tiene más de un nav.',
  },
  {
    name: 'activeId',
    type: 'string | null',
    default: 'null',
    description: 'Cuál es la pantalla en la que estás. Abre el grupo que la contiene.',
  },
  {
    name: 'expanded',
    type: 'boolean',
    default: 'true',
    description: 'Panel de 232 o rail de 72. Lo decide el consumidor; el rail sólo lo pide.',
  },
  {
    name: 'toggleLabel',
    type: 'string',
    default: '— (obligatorio)',
    description: 'Nombre del control que cambia el ancho, ya traducido.',
  },
  {
    name: 'itemSelect',
    type: 'output<NavItem>',
    default: '—',
    description: 'Un destino elegido. Un grupo nunca emite: abre.',
  },
  {
    name: 'expandedChange',
    type: 'output<boolean>',
    default: '—',
    description: 'El ancho pedido. El rail no se lo cambia solo.',
  },
  {
    name: '[navRailTop]',
    type: 'ranura proyectada',
    default: '—',
    description: 'Encima del árbol. Ahí va el bloque de favoritos; el rail no sabe qué es.',
  },
  {
    name: '[navRailFooter]',
    type: 'ranura proyectada',
    default: '—',
    description: 'Al pie. Credenciales y logo del cliente en el App Shell.',
  },
];

const TABS_PROPS: readonly PropRow[] = [
  {
    name: 'tabs',
    type: 'readonly Tab[]',
    default: '— (obligatorio)',
    description: '{ id, label, closable?, disabled? }. Cerrable salvo que diga lo contrario.',
  },
  {
    name: 'mode',
    type: "'section' | 'document'",
    default: "'section'",
    description: 'Subrayado para subsecciones; tarjeta cerrable para el MDI del App Shell.',
  },
  {
    name: 'activeId',
    type: 'string | null',
    default: 'null',
    description: 'Cuál está seleccionada. El panel lo pone el consumidor.',
  },
  {
    name: 'label',
    type: 'string',
    default: '— (obligatorio)',
    description: 'Nombre del tablist, ya traducido.',
  },
  {
    name: 'tabSelect',
    type: 'output<Tab>',
    default: '—',
    description: 'La pestaña elegida. No cambia la selección por su cuenta.',
  },
  {
    name: 'tabClose',
    type: 'output<Tab>',
    default: '—',
    description: 'La pestaña que se pidió cerrar. Cerrarla es del consumidor.',
  },
];

const CRUMB_PROPS: readonly PropRow[] = [
  {
    name: 'items',
    type: 'readonly Crumb[]',
    default: '— (obligatorio)',
    description: 'El camino. El último es la página actual y no es enlace.',
  },
  {
    name: 'label',
    type: 'string',
    default: '— (obligatorio)',
    description: 'Nombre del landmark, ya traducido.',
  },
  {
    name: 'expandLabel',
    type: '(hidden: number) => string',
    default: '— (obligatorio)',
    description: 'Cómo se llama el pliegue, con cuántos niveles esconde. Ya traducido.',
  },
  {
    name: 'crumbSelect',
    type: 'output<Crumb>',
    default: '—',
    description: 'El nivel elegido. La miga no navega.',
  },
];

const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'Fondo del rail y de la barra inferior', token: '--color-brand-navy' },
  { part: 'Texto e iconos sobre navy', token: '--color-text-on-dark' },
  { part: 'Pastilla del ítem activo', token: '--color-bg-primary' },
  { part: 'Texto del ítem activo', token: '--color-text-on-primary' },
  { part: 'Ancho del rail colapsado', token: '--nav-rail-width' },
  { part: 'Ancho del panel expandido', token: '--nav-panel-width' },
  { part: 'Alto de una pestaña', token: '--tab-height' },
  { part: 'Alto de la barra inferior', token: '--nav-bottom-height' },
  { part: 'Punto de corte de la barra inferior', token: '--breakpoint-nav-bottom' },
  { part: 'Anillo de foco sobre navy', token: '--color-focus-ring-on-dark' },
];

/**
 * /design-system/components/navigation: rail, miga y pestañas sincronizados a propósito,
 * porque el estado vive en quien compone. Sin router: si una pieza importara
 * @angular/router, el catálogo no podría mostrarla.
 */
@Component({
  selector: 'ewms-showroom-navigation',
  templateUrl: './navigation.html',
  imports: [NavRail, NavBottom, Tabs, Breadcrumbs, DemoFrame, PropTable, TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomNavigation {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly tree = TREE;
  protected readonly railProps = RAIL_PROPS;
  protected readonly tabsProps = TABS_PROPS;
  protected readonly crumbProps = CRUMB_PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly deepTrail = DEEP_TRAIL;

  protected readonly expanded = signal(true);
  protected readonly activeId = signal('articles');

  /** Las pestañas abiertas. En el App Shell esto lo lleva `TabsService`. */
  protected readonly openTabs = signal<readonly Tab[]>([
    { id: 'articles', label: 'Artículos' },
    { id: 'dashboard', label: 'Dashboard', closable: false },
  ]);

  protected readonly sectionTabs: readonly Tab[] = [
    { id: 'detail', label: 'Detalle' },
    { id: 'history', label: 'Historial' },
    { id: 'audit', label: 'Auditoría', disabled: true },
  ];
  protected readonly sectionActive = signal('detail');

  /**
   * Miga derivada del árbol: una tabla de caminos escrita a mano era una segunda
   * fuente de verdad que mentía al agregar un hijo.
   */
  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const active = this.activeId();
    const item = this.find(active);
    if (item === null) {
      return [];
    }
    const parent = parentOf(TREE, active);
    return parent === null
      ? [ROOT_CRUMB, { label: item.label }]
      : [ROOT_CRUMB, { label: parent.label }, { label: item.label }];
  });

  protected readonly expandLabel = (hidden: number): string =>
    `Mostrar ${hidden} niveles ocultos`;

  /** Elegir en el rail: cambia la miga y abre la pestaña si no estaba. */
  protected onItemSelect(item: NavItem): void {
    this.activeId.set(item.id);
    this.openTabs.update((tabs) =>
      tabs.some((tab) => tab.id === item.id) ? tabs : [...tabs, { id: item.id, label: item.label }],
    );
  }

  /** Elegir una pestaña: mueve el rail y la miga. El mismo estado. */
  protected onTabSelect(tab: Tab): void {
    this.activeId.set(tab.id);
  }

  /**
   * Cerrar la activa pasa la selección a la vecina; cerrar la última deja la lista
   * vacía y el foco en su sitio, nunca perdido en el body.
   */
  protected onTabClose(closed: Tab): void {
    const tabs = this.openTabs();
    const index = tabs.findIndex((tab) => tab.id === closed.id);
    const rest = tabs.filter((tab) => tab.id !== closed.id);
    this.openTabs.set(rest);

    if (this.activeId() === closed.id && rest.length > 0) {
      const neighbour = rest[Math.min(index, rest.length - 1)];
      if (neighbour !== undefined) {
        this.activeId.set(neighbour.id);
      }
    }
  }

  protected onExpandedChange(expanded: boolean): void {
    this.expanded.set(expanded);
  }

  protected onCrumbSelect(crumb: Crumb): void {
    // Una miga no navega: emite. Acá el catálogo se limita a subrayar cuál.
    this.lastCrumb.set(crumb.label);
  }

  protected readonly lastCrumb = signal<string | null>(null);

  private find(id: string): NavItem | null {
    for (const item of TREE) {
      if (item.id === id) {
        return item;
      }
      const child = item.children?.find((candidate) => candidate.id === id);
      if (child !== undefined) {
        return child;
      }
    }
    return null;
  }
}
