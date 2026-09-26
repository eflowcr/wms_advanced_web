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
import { TranslocoPipe } from '@jsverse/transloco';
import { DemoFrame } from '../../ui/demo-frame';
import { DocTable, type DocColumn } from '../../ui/doc-table';
import { PropTable, type PropRow } from '../../ui/prop-table';
import { Prose } from '../../ui/prose';
import { TokenValue } from '../../ui/token-value';
import { translated } from '../../ui/translated';
import { DEEP_TRAIL_RECORDS, RAIL_FOOTER_SESSION } from './navigation.fixtures';

/** Una pestaña abierta sin su etiqueta: la etiqueta sale del árbol traducido. */
type OpenTab = Omit<Tab, 'label'>;

/**
 * t(showroom.navigation.props.rail.items, showroom.navigation.props.rail.label,
 *   showroom.navigation.props.rail.activeId, showroom.navigation.props.rail.expanded,
 *   showroom.navigation.props.rail.toggleLabel, showroom.navigation.props.rail.drawer,
 *   showroom.navigation.props.rail.itemSelect,
 *   showroom.navigation.props.rail.expandedChange, showroom.navigation.props.rail.top,
 *   showroom.navigation.props.rail.footer)
 */
const RAIL_PROPS: readonly PropRow[] = [
  {
    name: 'items',
    type: 'readonly NavItem[]',
    default: '—',
    description: 'showroom.navigation.props.rail.items',
  },
  {
    name: 'label',
    type: 'string',
    default: '—',
    description: 'showroom.navigation.props.rail.label',
  },
  {
    name: 'activeId',
    type: 'string | null',
    default: 'null',
    description: 'showroom.navigation.props.rail.activeId',
  },
  {
    name: 'expanded',
    type: 'boolean',
    default: 'true',
    description: 'showroom.navigation.props.rail.expanded',
  },
  {
    name: 'toggleLabel',
    type: 'string',
    default: "''",
    description: 'showroom.navigation.props.rail.toggleLabel',
  },
  {
    name: 'drawer',
    type: 'boolean',
    default: 'false',
    description: 'showroom.navigation.props.rail.drawer',
  },
  {
    name: 'itemSelect',
    type: 'output<NavItem>',
    default: '—',
    description: 'showroom.navigation.props.rail.itemSelect',
  },
  {
    name: 'expandedChange',
    type: 'output<boolean>',
    default: '—',
    description: 'showroom.navigation.props.rail.expandedChange',
  },
  {
    name: '[navRailTop]',
    type: 'ng-content',
    default: '—',
    description: 'showroom.navigation.props.rail.top',
  },
  {
    name: '[navRailFooter]',
    type: 'ng-content',
    default: '—',
    description: 'showroom.navigation.props.rail.footer',
  },
];

/**
 * t(showroom.navigation.props.tabs.tabs, showroom.navigation.props.tabs.mode,
 *   showroom.navigation.props.tabs.activeId, showroom.navigation.props.tabs.label,
 *   showroom.navigation.props.tabs.tabSelect, showroom.navigation.props.tabs.tabClose)
 */
const TABS_PROPS: readonly PropRow[] = [
  {
    name: 'tabs',
    type: 'readonly Tab[]',
    default: '—',
    description: 'showroom.navigation.props.tabs.tabs',
  },
  {
    name: 'mode',
    type: "'section' | 'document'",
    default: "'section'",
    description: 'showroom.navigation.props.tabs.mode',
  },
  {
    name: 'activeId',
    type: 'string | null',
    default: 'null',
    description: 'showroom.navigation.props.tabs.activeId',
  },
  {
    name: 'label',
    type: 'string',
    default: '—',
    description: 'showroom.navigation.props.tabs.label',
  },
  {
    name: 'tabSelect',
    type: 'output<Tab>',
    default: '—',
    description: 'showroom.navigation.props.tabs.tabSelect',
  },
  {
    name: 'tabClose',
    type: 'output<Tab>',
    default: '—',
    description: 'showroom.navigation.props.tabs.tabClose',
  },
];

/**
 * t(showroom.navigation.props.crumbs.items, showroom.navigation.props.crumbs.label,
 *   showroom.navigation.props.crumbs.expandLabel, showroom.navigation.props.crumbs.crumbSelect)
 */
const CRUMB_PROPS: readonly PropRow[] = [
  {
    name: 'items',
    type: 'readonly Crumb[]',
    default: '—',
    description: 'showroom.navigation.props.crumbs.items',
  },
  {
    name: 'label',
    type: 'string',
    default: '—',
    description: 'showroom.navigation.props.crumbs.label',
  },
  {
    name: 'expandLabel',
    type: '(hidden: number) => string',
    default: '—',
    description: 'showroom.navigation.props.crumbs.expandLabel',
  },
  {
    name: 'crumbSelect',
    type: 'output<Crumb>',
    default: '—',
    description: 'showroom.navigation.props.crumbs.crumbSelect',
  },
];

/**
 * El marco claro (decisión del usuario, 2026-09-25): menú, chips, subrayado y cajón.
 * t(showroom.navigation.anatomy.parts.railBackground, showroom.navigation.anatomy.parts.rowHover,
 *   showroom.navigation.anatomy.parts.activeRow, showroom.navigation.anatomy.parts.activeText,
 *   showroom.navigation.anatomy.parts.railWidth, showroom.navigation.anatomy.parts.panelWidth,
 *   showroom.navigation.anatomy.parts.rowHeight, showroom.navigation.anatomy.parts.rowHeightCollapsed,
 *   showroom.navigation.anatomy.parts.drawerTransition, showroom.navigation.anatomy.parts.chip,
 *   showroom.navigation.anatomy.parts.chipHover, showroom.navigation.anatomy.parts.chipClose,
 *   showroom.navigation.anatomy.parts.chipFade, showroom.navigation.anatomy.parts.tabHeight,
 *   showroom.navigation.anatomy.parts.tabIndicator, showroom.navigation.anatomy.parts.bottomHeight,
 *   showroom.navigation.anatomy.parts.bottomBreakpoint,
 *   showroom.navigation.anatomy.parts.drawerBreakpoint)
 */
const ANATOMY: readonly { readonly part: string; readonly token: string }[] = [
  { part: 'showroom.navigation.anatomy.parts.railBackground', token: '--color-surface' },
  { part: 'showroom.navigation.anatomy.parts.rowHover', token: '--color-ghost-hover' },
  { part: 'showroom.navigation.anatomy.parts.activeRow', token: '--color-brand-navy' },
  { part: 'showroom.navigation.anatomy.parts.activeText', token: '--color-text-on-dark' },
  { part: 'showroom.navigation.anatomy.parts.railWidth', token: '--nav-rail-width' },
  { part: 'showroom.navigation.anatomy.parts.panelWidth', token: '--nav-panel-width' },
  { part: 'showroom.navigation.anatomy.parts.rowHeight', token: '--nav-row-height' },
  {
    part: 'showroom.navigation.anatomy.parts.rowHeightCollapsed',
    token: '--nav-row-height-collapsed',
  },
  {
    part: 'showroom.navigation.anatomy.parts.drawerTransition',
    token: '--transition-nav-drawer',
  },
  { part: 'showroom.navigation.anatomy.parts.chip', token: '--color-chip-bg' },
  { part: 'showroom.navigation.anatomy.parts.chipHover', token: '--color-chip-bg-hover' },
  { part: 'showroom.navigation.anatomy.parts.chipClose', token: '--color-chip-close-hover' },
  { part: 'showroom.navigation.anatomy.parts.chipFade', token: '--gradient-chip-fade-start' },
  { part: 'showroom.navigation.anatomy.parts.tabHeight', token: '--chip-height' },
  { part: 'showroom.navigation.anatomy.parts.tabIndicator', token: '--tab-indicator-width' },
  { part: 'showroom.navigation.anatomy.parts.bottomHeight', token: '--nav-bottom-height' },
  { part: 'showroom.navigation.anatomy.parts.bottomBreakpoint', token: '--breakpoint-nav-bottom' },
  { part: 'showroom.navigation.anatomy.parts.drawerBreakpoint', token: '--breakpoint-nav-drawer' },
];

/**
 * t(showroom.navigation.states.columns.state, showroom.navigation.states.columns.seen,
 *   showroom.navigation.states.columns.why)
 */
const STATE_COLUMNS: readonly DocColumn[] = [
  { id: 'state', label: 'showroom.navigation.states.columns.state' },
  { id: 'seen', label: 'showroom.navigation.states.columns.seen' },
  { id: 'why', label: 'showroom.navigation.states.columns.why' },
];

/**
 * Una fila por estado; la plantilla arma la clave con el id.
 * t(showroom.navigation.states.railCollapsed.name, showroom.navigation.states.railCollapsed.seen,
 *   showroom.navigation.states.railCollapsed.why, showroom.navigation.states.activeItem.name,
 *   showroom.navigation.states.activeItem.seen, showroom.navigation.states.activeItem.why,
 *   showroom.navigation.states.groupWithActive.name,
 *   showroom.navigation.states.groupWithActive.seen,
 *   showroom.navigation.states.groupWithActive.why, showroom.navigation.states.tabNotClosable.name,
 *   showroom.navigation.states.tabNotClosable.seen, showroom.navigation.states.tabNotClosable.why,
 *   showroom.navigation.states.tabDisabled.name, showroom.navigation.states.tabDisabled.seen,
 *   showroom.navigation.states.tabDisabled.why, showroom.navigation.states.singleCrumb.name,
 *   showroom.navigation.states.singleCrumb.seen, showroom.navigation.states.singleCrumb.why,
 *   showroom.navigation.states.bottomNoOverflow.name,
 *   showroom.navigation.states.bottomNoOverflow.seen,
 *   showroom.navigation.states.bottomNoOverflow.why, showroom.navigation.states.drawerOpen.name,
 *   showroom.navigation.states.drawerOpen.seen, showroom.navigation.states.drawerOpen.why,
 *   showroom.navigation.states.stripOverflow.name, showroom.navigation.states.stripOverflow.seen,
 *   showroom.navigation.states.stripOverflow.why)
 */
const STATES = [
  'railCollapsed',
  'activeItem',
  'groupWithActive',
  'drawerOpen',
  'stripOverflow',
  'tabNotClosable',
  'tabDisabled',
  'singleCrumb',
  'bottomNoOverflow',
] as const;

/** El ítem con ese id, en el primer nivel o en un grupo. */
function find(tree: readonly NavItem[], id: string): NavItem | null {
  for (const item of tree) {
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

/**
 * /design-system/components/navigation: rail, miga y pestañas sincronizados a propósito,
 * porque el estado vive en quien compone. Sin router: si una pieza importara
 * @angular/router, el catálogo no podría mostrarla.
 */
@Component({
  selector: 'ewms-showroom-navigation',
  templateUrl: './navigation.html',
  imports: [
    NavRail,
    NavBottom,
    Tabs,
    Breadcrumbs,
    DemoFrame,
    DocTable,
    PropTable,
    Prose,
    TokenValue,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowroomNavigation {
  protected readonly version = DESIGN_SYSTEM_VERSION;
  protected readonly railProps = RAIL_PROPS;
  protected readonly tabsProps = TABS_PROPS;
  protected readonly crumbProps = CRUMB_PROPS;
  protected readonly anatomy = ANATOMY;
  protected readonly stateColumns = STATE_COLUMNS;
  protected readonly states = STATES;
  protected readonly session = RAIL_FOOTER_SESSION;

  /**
   * Árbol real del App Shell, recortado: un grupo con muchos hijos y otro con pocos
   * es la forma que complica la navegación; tres ítems planos no enseñarían nada.
   * t(showroom.navigation.demo.tree.dashboard, showroom.navigation.demo.tree.catalogs,
   *   showroom.navigation.demo.tree.articles, showroom.navigation.demo.tree.clients,
   *   showroom.navigation.demo.tree.locations, showroom.navigation.demo.tree.lots,
   *   showroom.navigation.demo.tree.settings, showroom.navigation.demo.tree.settingsShort,
   *   showroom.navigation.demo.tree.users, showroom.navigation.demo.tree.params)
   */
  protected readonly tree = translated((t): readonly NavItem[] => [
    {
      id: 'dashboard',
      label: t('showroom.navigation.demo.tree.dashboard'),
      icon: 'dashboard',
      route: '/dashboard',
    },
    {
      id: 'catalogs',
      label: t('showroom.navigation.demo.tree.catalogs'),
      icon: 'inventory',
      children: [
        {
          id: 'articles',
          label: t('showroom.navigation.demo.tree.articles'),
          icon: 'package',
          route: '/catalogos/articulos',
        },
        {
          id: 'clients',
          label: t('showroom.navigation.demo.tree.clients'),
          icon: 'operator',
          route: '/catalogos/clientes',
        },
        {
          id: 'locations',
          label: t('showroom.navigation.demo.tree.locations'),
          icon: 'location',
          route: '/catalogos/ubicaciones',
        },
        {
          id: 'lots',
          label: t('showroom.navigation.demo.tree.lots'),
          icon: 'lot',
          route: '/catalogos/lotes',
          badge: 4,
        },
      ],
    },
    {
      id: 'settings',
      label: t('showroom.navigation.demo.tree.settings'),
      // Plegado se ve esta, dentro del nombre entero (WCAG 2.5.3).
      shortLabel: t('showroom.navigation.demo.tree.settingsShort'),
      icon: 'settings',
      children: [
        {
          id: 'users',
          label: t('showroom.navigation.demo.tree.users'),
          icon: 'operator',
          route: '/configuracion/usuarios',
        },
        {
          id: 'params',
          label: t('showroom.navigation.demo.tree.params'),
          icon: 'controls',
          route: '/configuracion/parametros',
        },
      ],
    },
  ]);

  /**
   * La raíz de la miga. Lo único del camino que no sale del árbol.
   * t(showroom.navigation.demo.home)
   */
  private readonly rootCrumb = translated((t): Crumb => ({
    label: t('showroom.navigation.demo.home'),
    route: '#',
  }));

  /**
   * Siete niveles: el caso que la ficha nombraba como pendiente de truncado. Los nombres del
   * almacén hacia abajo son registros (navigation.fixtures.ts); lo que la interfaz nombra, no.
   * t(showroom.navigation.demo.home, showroom.navigation.variants.crumbs.warehouses,
   *   showroom.navigation.variants.crumbs.location)
   */
  protected readonly deepTrail = translated((t): readonly Crumb[] => [
    { label: t('showroom.navigation.demo.home'), route: '/' },
    { label: t('showroom.navigation.variants.crumbs.warehouses'), route: '/almacenes' },
    { label: DEEP_TRAIL_RECORDS.warehouse, route: '/almacenes/cedi' },
    { label: DEEP_TRAIL_RECORDS.zone, route: '/almacenes/cedi/a' },
    { label: DEEP_TRAIL_RECORDS.aisle, route: '/almacenes/cedi/a/1' },
    { label: DEEP_TRAIL_RECORDS.rack, route: '/almacenes/cedi/a/1/12' },
    {
      label: t('showroom.navigation.variants.crumbs.location', {
        code: DEEP_TRAIL_RECORDS.location,
      }),
    },
  ]);

  protected readonly expanded = signal(true);
  /** La variante de pantalla media: abierto, el rail es un cajón sobre la página real. */
  protected readonly drawerOpen = signal(false);
  protected readonly activeId = signal('articles');

  /** Las pestañas abiertas. En el App Shell esto lo lleva `TabsService`. */
  private readonly open = signal<readonly OpenTab[]>([
    { id: 'articles' },
    { id: 'dashboard', closable: false },
  ]);

  /** Las abiertas con su etiqueta: sale del árbol, así cambia con el idioma. */
  protected readonly openTabs = computed<readonly Tab[]>(() => {
    const tree = this.tree();
    return this.open().map((tab) => ({ ...tab, label: find(tree, tab.id)?.label ?? tab.id }));
  });

  /**
   * t(showroom.navigation.variants.tabs.detail, showroom.navigation.variants.tabs.history,
   *   showroom.navigation.variants.tabs.audit)
   */
  protected readonly sectionTabs = translated((t): readonly Tab[] => [
    { id: 'detail', label: t('showroom.navigation.variants.tabs.detail') },
    { id: 'history', label: t('showroom.navigation.variants.tabs.history') },
    { id: 'audit', label: t('showroom.navigation.variants.tabs.audit'), disabled: true },
  ]);
  protected readonly sectionActive = signal('detail');

  /**
   * Miga derivada del árbol: una tabla de caminos escrita a mano era una segunda
   * fuente de verdad que mentía al agregar un hijo.
   */
  protected readonly crumbs = computed<readonly Crumb[]>(() => {
    const tree = this.tree();
    const root = this.rootCrumb();
    const active = this.activeId();
    const item = find(tree, active);
    if (item === null) {
      return [];
    }
    const parent = parentOf(tree, active);
    return parent === null
      ? [root, { label: item.label }]
      : [root, { label: parent.label }, { label: item.label }];
  });

  /** t(showroom.navigation.demo.expand) */
  protected readonly expandLabel = translated(
    (t) =>
      (hidden: number): string =>
        t('showroom.navigation.demo.expand', { hidden }),
  );

  /** Elegir en el rail: cambia la miga y abre la pestaña si no estaba. */
  protected onItemSelect(item: NavItem): void {
    this.activeId.set(item.id);
    this.open.update((tabs) =>
      tabs.some((tab) => tab.id === item.id) ? tabs : [...tabs, { id: item.id }],
    );
  }

  /** Desde el cajón: lo mismo que desde el rail, y el cajón se cierra, como en el App Shell. */
  protected onDrawerSelect(item: NavItem): void {
    this.onItemSelect(item);
    this.drawerOpen.set(false);
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
    const tabs = this.open();
    const index = tabs.findIndex((tab) => tab.id === closed.id);
    const rest = tabs.filter((tab) => tab.id !== closed.id);
    this.open.set(rest);

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
}
