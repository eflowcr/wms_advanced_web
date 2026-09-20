import { provideZonelessChangeDetection, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  EWMS_FAVORITE_LABELS,
  EWMS_FAVORITES_STORE,
  Favorites,
  InMemoryFavoritesStore,
  type FavoriteLabelResolver,
} from '@ewms/design-system';
import { expectNoAxeViolations } from '@ewms/testing';
import { ShowroomLayout } from '../layout/showroom-layout';
import { provideShowroomDesignSystem } from '../showroom.providers';
import { ShowroomBanner } from './components/banner';
import { ShowroomButton } from './components/button';
import { ShowroomCard } from './components/card';
import { ShowroomCheckbox } from './components/checkbox';
import { ShowroomDialog } from './components/dialog';
import { ShowroomIconButton } from './components/icon-button';
import { ShowroomInput } from './components/input';
import { ShowroomNavigation } from './components/navigation';
import { ShowroomPagination } from './components/pagination';
import { ShowroomRadio } from './components/radio';
import { ShowroomSearchSelect } from './components/search-select';
import { ShowroomSelect } from './components/select';
import { ShowroomTable } from './components/table';
import { ShowroomText } from './components/text';
import { ShowroomToast } from './components/toast';
import { ShowroomToggle } from './components/toggle';
import { ShowroomTooltip } from './components/tooltip';
import { FLOW_BUDGETS } from './patterns/click-budget';
import { ShowroomKeyboard } from './patterns/keyboard';
import { ShowroomSearchCreateEdit } from './patterns/search-create-edit';
import { ShowroomBrand } from './foundations/brand';
import { ShowroomColors } from './foundations/colors';
import { ShowroomSpacing } from './foundations/spacing';
import { ShowroomTypography } from './foundations/typography';
import { ShowroomHome } from './showroom-home';

/**
 * Every page, rendered.
 *
 * What a unit test can say about these pages is narrow on purpose: they are
 * judged by looking at them, and the numbers they show come from a real
 * stylesheet that jsdom does not have. So what is asserted here is structure
 * -- that the blocks exist, that the demos render the real component, that the
 * markup is accessible -- and the measured facts live in e2e/showroom.e2e.ts,
 * where there is a browser to measure in.
 */
/**
 * THE FAVOURITES' STORE, PROVIDED BY THE TEST AND NOT BY THE CATALOGUE.
 *
 * In the application the showroom renders inside the shell and reads the
 * shell's one list by injection. A unit test has no shell, so the test stands
 * in for it HERE -- in the `TestBed`, never in `showroom.providers.ts`. Putting
 * it back in production code to make a test pass is how a page got two lists.
 */
function provideApplicationFavorites() {
  return [{ provide: EWMS_FAVORITES_STORE, useClass: InMemoryFavoritesStore }, Favorites];
}

async function render<T>(component: Type<T>) {
  await TestBed.configureTestingModule({
    imports: [component],
    /*
     * The same providers the route installs. A page rendered without them is
     * not the page the catalogue serves -- and the design system's texts are
     * PROVIDED, not passed, so leaving them out would fail at injection rather
     * than at an assertion.
     */
    providers: [provideRouter([]), provideShowroomDesignSystem(), provideApplicationFavorites()],
  }).compileComponents();
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('ShowroomLayout', () => {
  it('lists every catalogue entry in the sidebar', async () => {
    const { element } = await render(ShowroomLayout);
    expect(element.querySelectorAll('[data-sidebar] nav li').length).toBeGreaterThan(20);
  });

  it('shows the design-system version instead of a number typed by hand', async () => {
    const { element } = await render(ShowroomLayout);
    expect(element.querySelector('[data-sidebar]')?.textContent).toMatch(/v\d+\.\d+\.\d+/);
  });

  it('links only the pages that exist, and labels the rest as pending', async () => {
    const { element } = await render(ShowroomLayout);
    const pending = [...element.querySelectorAll('[data-sidebar] nav li span')];
    expect(pending.length).toBeGreaterThan(0);
    for (const item of pending) {
      expect(item.textContent).toContain('(pendiente)');
    }
  });

  it('filters the catalogue as you type, by name and by selector', async () => {
    const { fixture, element } = await render(ShowroomLayout);
    const search = element.querySelector<HTMLInputElement>('#showroom-search');
    const count = () => element.querySelectorAll('[data-sidebar] nav li').length;

    // Two since DS-5: «Toggle» by name and «Favoritos» by its selector,
    // `ewms-favorite-toggle`. The search matching both is the point of it.
    search!.value = 'toggle';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(count()).toBe(2);

    search!.value = 'ewms-input';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(count()).toBe(1);

    search!.value = '';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(count()).toBeGreaterThan(20);
  });

  it('says so when nothing matches, instead of showing an empty panel', async () => {
    const { fixture, element } = await render(ShowroomLayout);
    const search = element.querySelector<HTMLInputElement>('#showroom-search');
    search!.value = 'zzzz-no-existe';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(element.textContent).toContain('Nada coincide con la búsqueda');
  });

  it('declares Spanish, so a screen reader does not read it with English phonetics', async () => {
    const { element } = await render(ShowroomLayout);
    expect(element.querySelector('[lang="es"]')).not.toBeNull();
  });

  /** Mark a route in the application's list, the way the header's star does. */
  async function mark(
    fixture: { detectChanges(): void; whenStable(): Promise<unknown> },
    route: string,
  ) {
    await TestBed.inject(Favorites).toggle(route);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('a catalogue page is NAMED from the catalogue, not from its path', async () => {
    // The store holds the route and nothing else (REQ-FE-DS4-002 v1.3); the
    // name is resolved when the block draws, and for a catalogue page that is
    // the entry's name -- so the block reads like the list underneath it.
    const { fixture, element } = await render(ShowroomLayout);

    await mark(fixture, '/design-system/components/button');

    expect(element.querySelector('[data-favorites-nav] [data-favorite]')?.textContent?.trim()).toBe(
      'Botón',
    );
  });

  it('a screen of the APPLICATION is named by the application, one level up', async () => {
    // One list means the sidebar also shows what was marked in the shell. The
    // catalogue does not know what «/catalogos/articulos» is called, and asks
    // the resolver above its own rather than showing a bare path.
    const application: FavoriteLabelResolver = {
      labelFor: (route) => signal(route === '/catalogos/articulos' ? 'Artículos' : '').asReadonly(),
      iconFor: () => 'package',
    };
    await TestBed.configureTestingModule({
      imports: [ShowroomLayout],
      providers: [
        provideRouter([]),
        provideApplicationFavorites(),
        { provide: EWMS_FAVORITE_LABELS, useValue: application },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ShowroomLayout);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    await mark(fixture, '/catalogos/articulos');
    await mark(fixture, '/design-system/components/button');

    const rows = [...element.querySelectorAll('[data-favorites-nav] [data-favorite]')];
    expect(rows.map((row) => row.textContent?.trim())).toEqual(['Artículos', 'Botón']);
  });

  it('ONE STAR PER PAGE, AND IT IS NOT THIS ONE: the layout carries the block only', async () => {
    // The star is the application's, in the header above this layout. A second
    // one here was a second `aria-pressed` for the same route over the same
    // list -- which is what two stores looked like from the outside.
    const { element } = await render(ShowroomLayout);

    expect(element.querySelector('[data-favorite-toggle]')).toBeNull();
    expect(element.querySelector('[aria-pressed]')).toBeNull();
    expect(element.querySelector('[data-favorites-nav]')).not.toBeNull();
  });

  it('THE CATALOGUE PROVIDES WORDS AND NO STATE: no store, no `Favorites`', () => {
    // The guard on the defect. A dictionary may be provided twice; the list
    // may not, and the day somebody adds it back here a catalogue page has two
    // lists again.
    const provided = provideShowroomDesignSystem().map((provider) =>
      typeof provider === 'object' && 'provide' in provider ? provider.provide : provider,
    );

    expect(provided).not.toContain(EWMS_FAVORITES_STORE);
    expect(provided).not.toContain(Favorites);
    expect(provided).toContain(EWMS_FAVORITE_LABELS);
  });

  it('marking fills the block in the sidebar, and choosing it navigates', async () => {
    const { fixture, element } = await render(ShowroomLayout);
    expect(element.querySelector('[data-favorites-empty]')).not.toBeNull();

    await mark(fixture, '/design-system/components/button');

    const entry = element.querySelector<HTMLButtonElement>('[data-favorites-nav] [data-favorite]');
    expect(entry).not.toBeNull();
    expect(element.querySelector('[data-favorites-empty]')).toBeNull();

    // The block does not navigate: it emits, and the catalogue navigates.
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    entry!.click();
    expect(navigate).toHaveBeenCalledWith('/design-system/components/button');
  });

  it('the block marks the page you are on, and follows you when you move', async () => {
    // `aria-current` comes from the URL the layout reads off the router, not
    // from the star: the star is not in this layout any more.
    await TestBed.configureTestingModule({
      imports: [ShowroomLayout],
      providers: [
        // Routes that MATCH, so the URL the layout reads is a real one. The
        // components are irrelevant -- what is under test is the block.
        provideRouter([
          { path: 'design-system/components/button', children: [] },
          { path: 'design-system/components/card', children: [] },
        ]),
        provideShowroomDesignSystem(),
        provideApplicationFavorites(),
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/design-system/components/button');

    const fixture = TestBed.createComponent(ShowroomLayout);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    await mark(fixture, '/design-system/components/button');

    const row = () => element.querySelector('[data-favorite="/design-system/components/button"]');
    expect(row()?.getAttribute('aria-current')).toBe('page');

    // A query string is not part of what a page IS.
    await router.navigateByUrl('/design-system/components/button?estado=cargando');
    await fixture.whenStable();
    expect(row()?.getAttribute('aria-current')).toBe('page');

    await router.navigateByUrl('/design-system/components/card');
    await fixture.whenStable();
    expect(row()?.getAttribute('aria-current')).toBeNull();
  });

  it('owns no second main landmark: the shell already renders one', async () => {
    const { element } = await render(ShowroomLayout);
    expect(element.querySelector('main')).toBeNull();
  });
});

describe('ShowroomHome', () => {
  it('indexes the catalogue and marks what does not exist yet', async () => {
    const { element } = await render(ShowroomHome);
    expect(element.querySelectorAll('[data-entry]').length).toBeGreaterThan(20);
    expect(element.querySelector('[data-entry="button"] a')).not.toBeNull();
    /*
     * `split-button` and not `navigation`: navigation stopped being a gap in
     * DS-5, as the table did in DS-3 lote C. The assertion is about a gap
     * still being VISIBLE rather than about which one it is -- a gap you can
     * see is information, and one you cannot is something everyone forgets.
     */
    expect(element.querySelector('[data-entry="split-button"] a')).toBeNull();
    expect(element.querySelector('[data-entry="split-button"]')?.textContent).toContain(
      '(pendiente)',
    );
    expect(element.querySelector('[data-entry="navigation"] a')).not.toBeNull();
    expect(element.querySelector('[data-entry="table"] a')).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { element } = await render(ShowroomHome);
    await expectNoAxeViolations(element);
  });
});

describe('ShowroomBrand', () => {
  it('shows the three shapes from the real files in the repository', async () => {
    const { element } = await render(ShowroomBrand);
    const shapes = [...element.querySelectorAll('[data-shape]')].map((el) =>
      el.getAttribute('data-shape'),
    );
    expect(shapes).toEqual(['isotipo', 'wordmark', 'lockup']);
    expect(element.querySelector('[data-shape="lockup"] img')?.getAttribute('src')).toBe(
      '/brand/ewms-lockup.svg',
    );
  });

  it('paints the mono file as a mask so it inherits the colour it is put on', async () => {
    const { element } = await render(ShowroomBrand);
    const mono = element.querySelector<HTMLElement>('[data-measure="brand-mono-navy"]');
    expect(mono?.style.getPropertyValue('mask-image')).toContain('ewms-lockup-mono.svg');
    // jsdom normalises the keyword's case; the point is that it is the keyword.
    expect(mono?.style.getPropertyValue('background-color')?.toLowerCase()).toBe('currentcolor');
  });

  it('shows the three ePRAC versions that the application actually uses', async () => {
    const { element } = await render(ShowroomBrand);
    const logos = [...element.querySelectorAll('[data-eprac]')].map((el) =>
      el.getAttribute('data-eprac'),
    );
    expect(logos).toEqual(['fullcolor', 'navy', 'blanco']);
  });

  it('marks the minimum size and clear space as not yet confirmed', async () => {
    const { element } = await render(ShowroomBrand);
    expect(element.textContent).toContain('(pendiente de confirmar con marca)');
  });

  it('has no accessibility violations', async () => {
    const { element } = await render(ShowroomBrand);
    await expectNoAxeViolations(element);
  });
});

describe('ShowroomColors', () => {
  it('groups the semantics by the role they play', async () => {
    const { element } = await render(ShowroomColors);
    const roles = [...element.querySelectorAll('[data-role]')].map((el) =>
      el.getAttribute('data-role'),
    );
    expect(roles).toContain('text');
    expect(roles).toContain('families');
    expect(roles).toContain('states');
  });

  it('has no accessibility violations', async () => {
    const { element } = await render(ShowroomColors);
    await expectNoAxeViolations(element);
  });
});

describe('ShowroomTypography', () => {
  it('renders the whole scale through the real typography component', async () => {
    const { element } = await render(ShowroomTypography);
    const steps = [...element.querySelectorAll('[data-scale-step]')].map((el) =>
      el.getAttribute('data-scale-step'),
    );
    expect(steps).toEqual(['h1', 'h2', 'h3', 'h4', 'p', 'caption', 'mono']);
    // The component renders the semantic element for the variant, always.
    expect(element.querySelector('[data-scale-step="h3"] h3')).not.toBeNull();
    expect(element.querySelector('[data-scale-step="p"] p')).not.toBeNull();
  });

  it('shows the four undecided values as pending instead of inventing them', async () => {
    const { element } = await render(ShowroomTypography);
    expect(element.textContent).toContain('(pendiente)');
    expect(element.textContent).toContain('Los huecos son información, no descuido');
  });
});

describe('ShowroomSpacing', () => {
  it('derives the whole scale from the one multiplier', async () => {
    const { element } = await render(ShowroomSpacing);
    const steps = [...element.querySelectorAll('[data-spacing-step]')].map((el) =>
      Number(el.getAttribute('data-spacing-step')),
    );
    expect(steps[0]).toBe(1);
    expect(steps).toContain(24);
  });

  it('puts a real Input, a real Select and a real Button in one row', async () => {
    const { element } = await render(ShowroomSpacing);
    expect(element.querySelector('[data-measure="mixed-input"] ewms-input')).not.toBeNull();
    expect(element.querySelector('[data-measure="mixed-select"] ewms-select')).not.toBeNull();
    expect(element.querySelector('[data-measure="mixed-button"] ewms-button')).not.toBeNull();
  });

  it('renders the three control heights and the three elevations', async () => {
    const { element } = await render(ShowroomSpacing);
    expect(element.querySelectorAll('[data-control-height]')).toHaveLength(3);
    expect(element.querySelectorAll('[data-measure^="--shadow"]')).toHaveLength(3);
  });

  it('renders the geometries that do not follow the control scale', async () => {
    const { element } = await render(ShowroomSpacing);
    expect(element.querySelector('[data-measure="checkbox-row"] ewms-checkbox')).not.toBeNull();
    expect(element.querySelector('[data-measure="toggle-row"] ewms-toggle')).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { element } = await render(ShowroomSpacing);
    await expectNoAxeViolations(element);
  });
});

describe('ShowroomButton', () => {
  it('carries the eight blocks, in order', async () => {
    const { element } = await render(ShowroomButton);
    const blocks = [...element.querySelectorAll('[data-block]')].map((el) =>
      el.getAttribute('data-block'),
    );
    expect(blocks).toEqual([
      '1-encabezado',
      '2-proposito',
      '3-demo',
      '4-variantes',
      '5-matriz',
      '6-tamanos',
      '7-anatomia',
      '8-contrato',
    ]);
  });

  it('renders the four variants with their canonical names', async () => {
    const { element } = await render(ShowroomButton);
    const variants = [...element.querySelectorAll('[data-variant]')].map((el) =>
      el.getAttribute('data-variant'),
    );
    expect(variants).toEqual(['primary', 'secondary', 'danger', 'ghost']);
  });

  it('renders the matrix with the real component in every cell', async () => {
    const { element } = await render(ShowroomButton);
    const matrix = element.querySelector('ewms-state-matrix');
    expect(matrix?.querySelectorAll('tbody ewms-button')).toHaveLength(20);
  });

  it('forces hover and focus with the token the component itself would use', async () => {
    const { fixture } = await render(ShowroomButton);
    const page = fixture.componentInstance as unknown as {
      forced(variant: string, state: string): string;
    };
    expect(page.forced('primary', 'hover')).toBe('[&_button]:bg-primary-hover');
    expect(page.forced('ghost', 'hover')).toBe(
      '[&_button]:bg-ghost-hover [&_button]:text-(color:--color-bg-primary-hover)',
    );
    expect(page.forced('danger', 'focus')).toContain('focus-ring-shadow');
    // Disabled and Loading are real inputs, so nothing is forced for them.
    expect(page.forced('primary', 'disabled')).toBe('');
    expect(page.forced('primary', 'default')).toBe('');
  });

  it('keeps the variant ids inside the component union, with no cast', async () => {
    const { fixture } = await render(ShowroomButton);
    const page = fixture.componentInstance as unknown as { variantFor(id: string): string };
    expect(page.variantFor('danger')).toBe('danger');
    expect(page.variantFor('no-such-variant')).toBe('primary');
  });

  it('counts one submit however many times it is clicked while loading', async () => {
    const { fixture, element } = await render(ShowroomButton);
    const button = element.querySelector<HTMLButtonElement>('[data-demo-submit] button');

    button?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Envíos registrados: 1');

    button?.click();
    button?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Envíos registrados: 1');
  });

  it('returns to Default on its own', async () => {
    const { fixture, element } = await render(ShowroomButton);
    const button = element.querySelector<HTMLButtonElement>('[data-demo-submit] button');

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      button?.click();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(element.querySelector('[data-demo-submit] button')?.getAttribute('aria-busy')).toBe(
        'true',
      );

      await vi.advanceTimersByTimeAsync(2000);
      fixture.detectChanges();
      expect(
        element.querySelector('[data-demo-submit] button')?.getAttribute('aria-busy'),
      ).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes "no aplica" rather than deleting a block that does not apply', async () => {
    const { element } = await render(ShowroomButton);
    expect(element.textContent).toContain('Bloques que no aplican');
  });
});

describe('the pages declare Spanish', () => {
  const pages: Type<unknown>[] = [
    ShowroomHome,
    ShowroomBrand,
    ShowroomColors,
    ShowroomTypography,
    ShowroomSpacing,
  ];

  it('marks every page root as Spanish (the showroom is exempt from i18n)', async () => {
    for (const page of pages) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
      const { element } = await render(page);
      expect(element.querySelector('[lang="es"]'), page.name).not.toBeNull();
    }
  });
});

/**
 * The eight sheets of DS-2 PR 4.
 *
 * WHAT THESE CAN AND CANNOT SAY. jsdom lays nothing out, so every measured
 * claim these pages make -- 18x18, 44x24, a square icon button, a field and a
 * button sharing a height -- is asserted in e2e/showroom.e2e.ts instead, in a
 * browser. What is left here is what a DOM alone can answer: the eight blocks
 * are present and in order, the demos render the REAL component rather than a
 * picture of it, and the markup is accessible.
 *
 * The axe run matters more on these than on the earlier pages: every one of
 * them renders a dozen or more instances of a control, and a control rendered
 * a dozen times is a dozen chances to leave one without a name.
 */
const BLOCKS = [
  '1-encabezado',
  '2-proposito',
  '3-demo',
  '4-variantes',
  '5-matriz',
  '6-tamanos',
  '7-anatomia',
  '8-contrato',
];

/**
 * `Type<unknown>` on purpose: the eight sheets share no base class and the
 * loop only ever renders them, so a union of eight component types would be a
 * union nothing can be assigned to.
 */
const SHEETS: readonly { name: string; component: Type<unknown>; heading: string }[] = [
  { name: 'ShowroomText', component: ShowroomText, heading: 'Texto' },
  { name: 'ShowroomIconButton', component: ShowroomIconButton, heading: 'Icon Button' },
  { name: 'ShowroomTooltip', component: ShowroomTooltip, heading: 'Tooltip' },
  { name: 'ShowroomInput', component: ShowroomInput, heading: 'Input' },
  { name: 'ShowroomSelect', component: ShowroomSelect, heading: 'Select / Dropdown' },
  { name: 'ShowroomCheckbox', component: ShowroomCheckbox, heading: 'Checkbox' },
  { name: 'ShowroomRadio', component: ShowroomRadio, heading: 'Radio' },
  { name: 'ShowroomToggle', component: ShowroomToggle, heading: 'Toggle' },
  { name: 'ShowroomBanner', component: ShowroomBanner, heading: 'Banner' },
  { name: 'ShowroomToast', component: ShowroomToast, heading: 'Toast' },
  { name: 'ShowroomCard', component: ShowroomCard, heading: 'Card' },
  { name: 'ShowroomDialog', component: ShowroomDialog, heading: 'Dialog' },
  {
    name: 'ShowroomSearchSelect',
    component: ShowroomSearchSelect,
    heading: 'Selector con búsqueda',
  },
  { name: 'ShowroomTable', component: ShowroomTable, heading: 'Tabla de datos' },
  { name: 'ShowroomPagination', component: ShowroomPagination, heading: 'Paginación' },
  { name: 'ShowroomNavigation', component: ShowroomNavigation, heading: 'Navegación' },
];

/**
 * The pattern pages (DS-4). NOT component sheets -- a pattern is a
 * composition, and what it documents is a flow rather than an element -- but
 * they carry the SAME EIGHT BLOCKS, and that is the point: the catalogue is
 * read in series, and a page with a shape of its own is a page you have to
 * learn separately. The two blocks that genuinely do not apply say so out
 * loud instead of being dropped, exactly like the Pagination's.
 */
const PATTERNS: readonly { name: string; component: Type<unknown>; heading: string }[] = [
  { name: 'ShowroomKeyboard', component: ShowroomKeyboard, heading: 'Atajos de teclado' },
  {
    name: 'ShowroomSearchCreateEdit',
    component: ShowroomSearchCreateEdit,
    heading: 'Buscar, crear, editar',
  },
];

describe.each([...SHEETS, ...PATTERNS])('$name', ({ component, heading }) => {
  it('carries the eight blocks, in order', async () => {
    const { element } = await render(component);
    const blocks = [...element.querySelectorAll('[data-block]')].map((el) =>
      el.getAttribute('data-block'),
    );
    expect(blocks).toEqual(BLOCKS);
  });

  it('names itself with an h1 and links its sheet in the vault', async () => {
    const { element } = await render(component);
    expect(element.querySelector('h1')?.textContent?.trim()).toBe(heading);
    expect(element.querySelector('[data-block="1-encabezado"]')?.textContent).toContain(
      '08-Sistema-de-Diseno/Componentes/',
    );
  });

  it('declares Spanish, so a screen reader does not read it with English phonetics', async () => {
    const { element } = await render(component);
    expect(element.querySelector('[lang="es"]')).not.toBeNull();
  });

  /*
   * A LONGER TIMEOUT THAN THE DEFAULT, AND IT IS NOT A DEFECT BEING HIDDEN.
   *
   * What is under test is whether axe finds a violation, never how long axe
   * takes. Some of these pages render half a dozen tables -- one of them
   * virtualising five thousand rows -- and auditing all of that inside jsdom
   * sits close enough to the default five seconds that the Table's page failed
   * intermittently on a loaded machine, with a timeout and no violation. A
   * limit a run can cross for reasons that have nothing to do with the
   * assertion is a limit that teaches people to re-run the build.
   *
   * Twenty seconds is far above anything measured here and still far below a
   * hang: an axe run that genuinely never returns still fails.
   */
  it('has no accessibility violations', async () => {
    const { element } = await render(component);
    await expectNoAxeViolations(element);
  }, 20_000);
});

describe('ShowroomText', () => {
  it('renders the seven variants through the real component', async () => {
    const { element } = await render(ShowroomText);
    const variants = [...element.querySelectorAll('[data-variant]')].map((el) =>
      el.getAttribute('data-variant'),
    );
    expect(variants).toEqual(['h1', 'h2', 'h3', 'h4', 'p', 'caption', 'mono']);
  });

  it('couples the variant to the element it renders, with no escape hatch', async () => {
    const { element } = await render(ShowroomText);
    // The claim of the whole component, checked on the rendered demo rather
    // than on the table that describes it.
    expect(element.querySelector('[data-variant-sample="h3"] h3')).not.toBeNull();
    expect(element.querySelector('[data-variant-sample="caption"] span')).not.toBeNull();
    expect(element.querySelector('[data-variant-sample="caption"] h4')).toBeNull();
  });

  it('says the two blocks that do not apply, instead of dropping them', async () => {
    const { element } = await render(ShowroomText);
    expect(element.querySelector('[data-block="5-matriz"]')?.textContent).toContain('no aplica');
    expect(element.querySelector('[data-block="6-tamanos"]')?.textContent).toContain('No aplica');
  });

  it('keeps the variant ids inside the component union, with no cast', async () => {
    const { fixture } = await render(ShowroomText);
    const page = fixture.componentInstance as unknown as {
      variantFor(id: string): string;
      sampleFor(id: string): string;
      tagFor(id: string): string;
      isHeading(id: string): boolean;
      isPending(row: { pending: readonly string[] }, token: string): boolean;
    };

    expect(page.variantFor('caption')).toBe('caption');
    // An id the union does not know falls back to the least surprising variant
    // rather than casting a string into the component's type.
    expect(page.variantFor('no-such-variant')).toBe('p');
    expect(page.sampleFor('no-such-variant')).toBe('');
    expect(page.tagFor('no-such-variant')).toBe('…');

    expect(page.isHeading('h4')).toBe(true);
    expect(page.isHeading('caption')).toBe(false);

    expect(page.isPending({ pending: ['--text-mono-weight'] }, '--text-mono-weight')).toBe(true);
    expect(page.isPending({ pending: [] }, '--text-mono-weight')).toBe(false);
  });
});

describe('ShowroomIconButton', () => {
  it('renders the four variants and the full matrix with the real component', async () => {
    const { element } = await render(ShowroomIconButton);
    const variants = [...element.querySelectorAll('[data-variant]')].map((el) =>
      el.getAttribute('data-variant'),
    );
    expect(variants).toEqual(['primary', 'secondary', 'danger', 'ghost']);

    const matrix = element.querySelector('ewms-state-matrix');
    expect(matrix?.querySelectorAll('tbody ewms-icon-button')).toHaveLength(20);
  });

  it('forces hover and focus with the token the component itself would use', async () => {
    const { fixture } = await render(ShowroomIconButton);
    const page = fixture.componentInstance as unknown as {
      forced(variant: string, state: string): string;
    };
    expect(page.forced('primary', 'hover')).toBe('[&_button]:bg-primary-hover');
    // Ghost darkens its text as well as its ground -- the PR 3 axe finding.
    expect(page.forced('ghost', 'hover')).toContain('text-(color:--color-bg-primary-hover)');
    // Disabled and Loading are real inputs, so nothing is forced for them.
    expect(page.forced('primary', 'disabled')).toBe('');
    expect(page.forced('primary', 'loading')).toBe('');
  });

  it('falls back to the component default rather than casting an unknown id', async () => {
    const { fixture } = await render(ShowroomIconButton);
    const page = fixture.componentInstance as unknown as {
      variantFor(id: string): string;
      forced(variant: string, state: string): string;
    };
    expect(page.variantFor('danger')).toBe('danger');
    // Ghost, because that is this component's default -- not Primary, which is
    // the Button's.
    expect(page.variantFor('no-such-variant')).toBe('ghost');
    expect(page.forced('no-such-variant', 'hover')).toBe('');
  });

  it('gives every demo instance a name, which is what the component is for', async () => {
    const { element } = await render(ShowroomIconButton);
    const buttons = [...element.querySelectorAll('button[aria-label]')];
    expect(buttons.length).toBeGreaterThan(20);
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')?.length).toBeGreaterThan(0);
    }
  });
});

describe('ShowroomTooltip', () => {
  it('documents the directive by what you type on the host, not by its field name', async () => {
    const { element } = await render(ShowroomTooltip);
    const first = element.querySelector('ewms-prop-table tbody th code');
    expect(first?.textContent).toBe('[ewmsTooltip]');
  });

  it('shows the directive applied to a host it does not own', async () => {
    const { element } = await render(ShowroomTooltip);
    // The descriptive case goes on a plain element: that is the whole point of
    // a directive, and it is what the prefixed selector exists for.
    expect(element.querySelector('[data-demo-describes]')).not.toBeNull();
  });

  it('suppresses the tooltip without ever suppressing a name', async () => {
    const { fixture, element } = await render(ShowroomTooltip);
    const host = element.querySelector('[data-demo-suppressed] button');
    const toggle = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Suprimir el tooltip'),
    );

    expect(host?.textContent).toContain('Descargar');
    toggle?.click();
    await fixture.whenStable();
    // The switch flipped, and the control still says what it is.
    expect(element.textContent).toContain('Reactivar el tooltip');
    expect(host?.textContent).toContain('Descargar');
  });

  it('spells out the three rules of 1.4.13, which are requirements and not polish', async () => {
    const { element } = await render(ShowroomTooltip);
    const block = element.querySelector('[data-block="5-matriz"]')?.textContent ?? '';
    expect(block).toContain('Descartable');
    expect(block).toContain('Apuntable');
    expect(block).toContain('Persistente');
  });
});

describe('ShowroomInput', () => {
  it('renders the five types through the real component', async () => {
    const { element } = await render(ShowroomInput);
    const variants = [...element.querySelectorAll('[data-variant]')].map((el) =>
      el.getAttribute('data-variant'),
    );
    expect(variants).toEqual(['text', 'number', 'password', 'search', 'textarea']);
  });

  it('drives the demo from a real reactive form, not from a local copy', async () => {
    const { fixture, element } = await render(ShowroomInput);
    const page = fixture.componentInstance as unknown as {
      form: { controls: { sku: { setValue(value: string): void } } };
    };

    // Writing the CONTROL has to change the readout: that is the only way the
    // page can claim the component is a real ControlValueAccessor.
    page.form.controls.sku.setValue('SKU-99999-Z');
    await fixture.whenStable();
    expect(element.querySelector('[data-demo-value]')?.textContent).toContain('SKU-99999-Z');

    const input = element.querySelector<HTMLInputElement>('[data-demo-form] input');
    expect(input?.value).toBe('SKU-99999-Z');
  });

  it('renders the suffix buttons with the Spanish names the page supplies', async () => {
    const { element } = await render(ShowroomInput);
    const labels = [...element.querySelectorAll('button[aria-label]')].map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(labels).toContain('Mostrar la clave');
  });

  it('reports the two prefixed outputs, which is why they are prefixed', async () => {
    const { fixture, element } = await render(ShowroomInput);
    const input = element.querySelector<HTMLInputElement>('[data-demo-form] input');

    /*
     * Driven through the DOM methods rather than by dispatching events whose
     * names are written out here. The second of those names is also a stock
     * Tailwind utility, and gate 10 reads every string literal in a .ts file as
     * a possible class name -- the same collision that made the component's own
     * outputs prefixed, arriving from the other side.
     */
    input?.focus();
    await fixture.whenStable();
    input?.blur();
    await fixture.whenStable();

    // The counters move, which means the page is bound to (fieldFocus) and
    // (fieldBlur) and not to the native pair travelling up from the <input>.
    expect(element.querySelector('[data-demo-form] dl')?.textContent).toContain('1 / 1');
  });

  it('keeps the matrix ids inside the component unions, with no cast', async () => {
    const { fixture } = await render(ShowroomInput);
    const page = fixture.componentInstance as unknown as {
      stateFor(id: string): string;
      sizeFor(id: string): string;
    };
    expect(page.stateFor('readonly')).toBe('readonly');
    expect(page.stateFor('no-such-state')).toBe('default');
    expect(page.sizeFor('lg')).toBe('lg');
    expect(page.sizeFor('no-such-size')).toBe('md');
  });
});

describe('ShowroomSelect', () => {
  it('renders the matrix with the real component in every cell', async () => {
    const { element } = await render(ShowroomSelect);
    const matrix = element.querySelector('ewms-state-matrix');
    expect(matrix?.querySelectorAll('tbody ewms-select')).toHaveLength(12);
  });

  it('keeps the panel out of the page until it is opened', async () => {
    const { element } = await render(ShowroomSelect);
    // The panel is a CDK overlay: nothing in the component's own DOM.
    expect(element.querySelector('[role="listbox"]')).toBeNull();
  });

  it('drives each matrix row from real inputs, and falls back on unknown ids', async () => {
    const { fixture } = await render(ShowroomSelect);
    const page = fixture.componentInstance as unknown as {
      sizeFor(id: string): string;
      valueFor(id: string): unknown;
      isError(id: string): boolean;
      isDisabled(id: string): boolean;
      chosenLabel(): string;
    };

    expect(page.sizeFor('sm')).toBe('sm');
    expect(page.sizeFor('no-such-size')).toBe('md');
    // Only one row starts with a value; the rest show the placeholder.
    expect(page.valueFor('selected')).toBe('muelle-3');
    expect(page.valueFor('default')).toBeNull();
    expect(page.isError('error')).toBe(true);
    expect(page.isError('default')).toBe(false);
    expect(page.isDisabled('disabled')).toBe(true);
    expect(page.isDisabled('default')).toBe(false);
    expect(page.chosenLabel()).toBe('Muelle 3');
  });

  it('says so when the form holds a value no option carries', async () => {
    const { fixture } = await render(ShowroomSelect);
    const page = fixture.componentInstance as unknown as {
      form: { controls: { ubicacion: { setValue(value: unknown): void } } };
      chosenLabel(): string;
    };
    page.form.controls.ubicacion.setValue('una-que-no-existe');
    await fixture.whenStable();
    expect(page.chosenLabel()).toBe('(sin elegir)');
  });
});

describe('ShowroomCheckbox', () => {
  it('drives the select-all box from the rows, and back', async () => {
    const { fixture, element } = await render(ShowroomCheckbox);
    const boxes = [...element.querySelectorAll<HTMLInputElement>('[data-demo-checklist] input')];
    const [header, ...rows] = boxes;
    expect(header).toBeDefined();

    // One of three rows starts on, so the header starts mixed.
    expect(header!.getAttribute('aria-checked')).toBe('mixed');

    header!.checked = true;
    header!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(header!.getAttribute('aria-checked')).toBe('true');
    for (const box of rows) {
      expect(box.checked).toBe(true);
    }
  });

  it('renders the third state, which is the one thing only this page can show', async () => {
    const { element } = await render(ShowroomCheckbox);
    const mixed = [...element.querySelectorAll('[aria-checked="mixed"]')];
    expect(mixed.length).toBeGreaterThan(0);
  });

  it('moves the select-all box out of mixed when one row completes the set', async () => {
    const { fixture, element } = await render(ShowroomCheckbox);
    const boxes = [...element.querySelectorAll<HTMLInputElement>('[data-demo-checklist] input')];
    const [header, first, , third] = boxes;

    // Two of three on: still mixed.
    first!.checked = true;
    first!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(header!.getAttribute('aria-checked')).toBe('mixed');

    // The third completes the set, and only then is the header checked.
    third!.checked = true;
    third!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(header!.getAttribute('aria-checked')).toBe('true');
  });

  it('forces only hover and focus, and leaves disabled a real input', async () => {
    const { fixture } = await render(ShowroomCheckbox);
    const page = fixture.componentInstance as unknown as { forced(state: string): string };
    expect(page.forced('hover')).toContain('border-(--color-bg-primary)');
    expect(page.forced('focus')).toContain('focus-ring-shadow');
    expect(page.forced('disabled')).toBe('');
  });

  it('reads the three values of the matrix row axis', async () => {
    const { fixture } = await render(ShowroomCheckbox);
    const page = fixture.componentInstance as unknown as {
      isOn(value: string): boolean;
      isMixed(value: string): boolean;
    };
    expect(page.isOn('on')).toBe(true);
    expect(page.isOn('off')).toBe(false);
    expect(page.isMixed('mixed')).toBe(true);
    expect(page.isMixed('on')).toBe(false);
  });
});

describe('ShowroomRadio', () => {
  it('groups the demo natively and reports the value from the form', async () => {
    const { fixture, element } = await render(ShowroomRadio);
    const options = [...element.querySelectorAll<HTMLInputElement>('[data-demo-group] input')];
    expect(options).toHaveLength(3);

    options[2]!.checked = true;
    options[2]!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(element.querySelector('[data-demo-value]')?.textContent).toContain('traslado');
  });

  it('gives every matrix cell its own group, so one click cannot light up the rest', async () => {
    const { fixture } = await render(ShowroomRadio);
    const page = fixture.componentInstance as unknown as {
      cellName(value: string, state: string): string;
    };
    expect(page.cellName('off', 'hover')).not.toBe(page.cellName('on', 'hover'));
  });

  it('caches one control per cell, and forces only hover and focus', async () => {
    const { fixture } = await render(ShowroomRadio);
    const page = fixture.componentInstance as unknown as {
      controlFor(value: string, state: string): { value: unknown; disabled: boolean };
      forced(state: string): string;
    };

    // Same cell, same control: a new one per change-detection pass would reset
    // the dot on every render.
    expect(page.controlFor('on', 'default')).toBe(page.controlFor('on', 'default'));
    expect(page.controlFor('on', 'default').value).not.toBeNull();
    expect(page.controlFor('off', 'default').value).toBeNull();
    // The Disabled column is disabled THROUGH THE FORM, which is the half of
    // the OR that nothing else exercises.
    expect(page.controlFor('on', 'disabled').disabled).toBe(true);

    expect(page.forced('hover')).toContain('border-(--color-bg-primary)');
    expect(page.forced('disabled')).toBe('');
  });

  it('says so when the form holds a value no option carries', async () => {
    const { fixture } = await render(ShowroomRadio);
    const page = fixture.componentInstance as unknown as {
      form: { controls: { tipo: { setValue(value: unknown): void } } };
      chosenLabel(): string;
    };
    page.form.controls.tipo.setValue('una-que-no-existe');
    await fixture.whenStable();
    expect(page.chosenLabel()).toBe('(ninguno)');
  });
});

describe('ShowroomToggle', () => {
  it('applies on touch: the counter moves with no Save anywhere', async () => {
    const { fixture, element } = await render(ShowroomToggle);
    const switches = [
      ...element.querySelectorAll<HTMLInputElement>('[data-demo-preferences] input'),
    ];

    switches[1]!.checked = true;
    switches[1]!.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(element.querySelector('[data-demo-preferences]')?.textContent).toContain(
      'Cambios aplicados: 1',
    );

    // The rule the demo exists to embody.
    expect(element.textContent).not.toContain('Guardar cambios');
  });

  it('announces itself as a switch and not as a checkbox', async () => {
    const { element } = await render(ShowroomToggle);
    const inputs = [...element.querySelectorAll('[data-demo-preferences] input')];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.getAttribute('role')).toBe('switch');
    }
  });

  it('chooses the hover token by value, because the two tracks hover differently', async () => {
    const { fixture } = await render(ShowroomToggle);
    const page = fixture.componentInstance as unknown as {
      forced(value: string, state: string): string;
    };
    expect(page.forced('off', 'hover')).toContain('--color-border-strong-hover');
    expect(page.forced('on', 'hover')).toContain('--color-bg-primary-hover');
    expect(page.forced('on', 'disabled')).toBe('');
    expect(page.forced('no-such-value', 'hover')).toBe('');
  });

  it('reads the two values of the matrix row axis', async () => {
    const { fixture } = await render(ShowroomToggle);
    const page = fixture.componentInstance as unknown as { isOn(value: string): boolean };
    expect(page.isOn('on')).toBe(true);
    expect(page.isOn('off')).toBe(false);
  });
});

/**
 * The three sheets of DS-3 lote A.
 *
 * Same division of labour as the eight above: structure and behaviour here,
 * anything with a pixel in it in e2e/showroom.e2e.ts.
 */
describe('ShowroomBanner', () => {
  it('renders the four variants through the real component', async () => {
    const { element } = await render(ShowroomBanner);
    expect(element.querySelectorAll('[data-icon-sample] ewms-banner').length).toBe(4);
  });

  it('pairs each variant with its role, and Info with status', async () => {
    const { element } = await render(ShowroomBanner);
    // The banner's own box, not the icon inside it: the icon is role="img".
    const roles = [...element.querySelectorAll('[data-icon-sample] ewms-banner > div')].map((box) =>
      box.getAttribute('role'),
    );
    expect(roles).toEqual(['status', 'alert', 'alert', 'status']);
  });

  it('shows that (dismiss) does NOT take the banner off the screen', async () => {
    const { fixture, element } = await render(ShowroomBanner);
    const close = element.querySelector<HTMLButtonElement>('[data-demo-banner] button');

    close!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-dismiss-count]')?.textContent).toBe('1');
    expect(element.querySelector('[data-demo-banner] ewms-banner')).not.toBeNull();
  });

  it('falls back to Info for an id no variant carries', async () => {
    const { fixture } = await render(ShowroomBanner);
    const page = fixture.componentInstance as unknown as {
      descriptionFor(stateId: string, id: string): string;
      isDismissible(stateId: string): boolean;
      variantFor(id: string): string;
    };
    expect(page.descriptionFor('title-only', 'danger')).toBe('');
    expect(page.descriptionFor('full', 'danger')).not.toBe('');
    expect(page.isDismissible('dismissible')).toBe(true);
    expect(page.isDismissible('full')).toBe(false);
    expect(page.variantFor('no-such-variant')).toBe('info');
  });
});

describe('ShowroomToast', () => {
  it('drives the real queue: the counter follows what the buttons raise', async () => {
    const { fixture, element } = await render(ShowroomToast);
    const size = () => element.querySelector('[data-queue-size]')?.textContent;

    expect(size()).toBe('0');

    element.querySelector<HTMLButtonElement>('[data-raise="success"] button')!.click();
    await fixture.whenStable();
    expect(size()).toBe('1');

    element.querySelector<HTMLButtonElement>('[data-raise-sticky] button')!.click();
    await fixture.whenStable();
    expect(size()).toBe('2');

    element.querySelector<HTMLButtonElement>('[data-clear] button')!.click();
    await fixture.whenStable();
    expect(size()).toBe('0');
  });

  it('mounts NO outlet of its own: the shell already has the only one', async () => {
    const { element } = await render(ShowroomToast);
    expect(element.querySelector('ewms-toast-outlet')).toBeNull();
    expect(element.querySelector('[aria-live]')).toBeNull();
  });

  it('paints the matrix cells from literal token classes, never assembled ones', async () => {
    const { fixture } = await render(ShowroomToast);
    const page = fixture.componentInstance as unknown as {
      cellClasses(stateId: string, variantId: string): string;
    };
    expect(page.cellClasses('accent', 'info')).toContain('bg-neutral-solid');
    expect(page.cellClasses('family', 'danger')).toContain('bg-danger-surface');
    expect(page.cellClasses('family', 'no-such-variant')).toBe('');
  });
});

describe('ShowroomCard', () => {
  it('renders the warehouse picker as one radiogroup of four radios', async () => {
    const { element } = await render(ShowroomCard);
    expect(element.querySelector('[data-demo-warehouses] [role="radiogroup"]')).not.toBeNull();
    expect(element.querySelectorAll('[data-demo-warehouses] [role="radio"]').length).toBe(4);
  });

  it('is ONE tab stop, and counts it off the DOM instead of promising it', async () => {
    const { element } = await render(ShowroomCard);
    const stops = element.querySelectorAll('[data-demo-warehouses] [role="radio"][tabindex="0"]');
    expect(stops.length).toBe(1);
    expect(element.querySelector('[data-tab-stops]')?.textContent).toBe('1');
    expect(element.querySelector('[data-cards-count]')?.textContent).toBe('4');
  });

  it('writes the chosen warehouse back to the form', async () => {
    const { fixture, element } = await render(ShowroomCard);
    const radios = [
      ...element.querySelectorAll<HTMLElement>('[data-demo-warehouses] [role="radio"]'),
    ];

    radios[0]!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-demo-value]')?.textContent).toBe('norte');
  });

  it('keeps the unavailable warehouse out of the tab order and out of the choice', async () => {
    const { fixture, element } = await render(ShowroomCard);
    const last = element.querySelectorAll<HTMLElement>('[data-demo-warehouses] [role="radio"]')[3]!;

    expect(last.getAttribute('tabindex')).toBeNull();
    last.click();
    await fixture.whenStable();
    expect(last.getAttribute('aria-checked')).toBe('false');
  });

  it('forces hover only on the option row, with the component own token', async () => {
    const { fixture } = await render(ShowroomCard);
    const page = fixture.componentInstance as unknown as {
      forced(variantId: string, stateId: string): string;
      isOption(variantId: string): boolean;
      matrixValue(stateId: string): unknown;
      matrixDisabled(stateId: string): boolean;
    };
    expect(page.forced('option', 'hover')).toContain('--color-border-strong');
    expect(page.forced('content', 'hover')).toBe('');
    expect(page.forced('option', 'default')).toBe('');
    expect(page.isOption('option')).toBe(true);
    expect(page.isOption('content')).toBe(false);
    expect(page.matrixValue('selected')).toBe('central');
    expect(page.matrixValue('default')).toBeNull();
    expect(page.matrixDisabled('disabled')).toBe(true);
    expect(page.matrixDisabled('default')).toBe(false);
  });

  it('says so when the form holds a warehouse no card carries', async () => {
    const { fixture } = await render(ShowroomCard);
    const page = fixture.componentInstance as unknown as {
      form: { controls: { almacen: { setValue(value: unknown): void } } };
      chosenLabel(): string;
    };
    page.form.controls.almacen.setValue('una-que-no-existe');
    await fixture.whenStable();
    expect(page.chosenLabel()).toBe('(ninguno)');
  });
});

/**
 * The two sheets of DS-3 lote B.
 *
 * Both pages drive machinery that lives outside their own tree -- the dialog
 * renders in the CDK's overlay container, the search panel in another -- so
 * these tests clean the container up after themselves. A leftover overlay is
 * the sort of thing that makes the NEXT test fail for no visible reason.
 */
function clearOverlays(): void {
  for (const container of document.querySelectorAll('.cdk-overlay-container')) {
    container.remove();
  }
}

describe('ShowroomDialog', () => {
  afterEach(clearOverlays);

  it('opens a real dialog and reports what the promise answered', async () => {
    const { fixture, element } = await render(ShowroomDialog);
    document.body.appendChild(element);

    element.querySelector<HTMLButtonElement>('[data-open="danger"] button')!.click();
    await fixture.whenStable();

    const dialog = document.querySelector('cdk-dialog-container');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Eliminar la expedición');

    // Cancel: three of the four ways out answer false.
    document.querySelectorAll<HTMLButtonElement>('cdk-dialog-container button')[0]!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-last-answer]')?.textContent).toContain('no confirmado');
    element.remove();
  });

  it('answers true only through the confirm button', async () => {
    const { fixture, element } = await render(ShowroomDialog);
    document.body.appendChild(element);

    element.querySelector<HTMLButtonElement>('[data-open="info"] button')!.click();
    await fixture.whenStable();

    document.querySelectorAll<HTMLButtonElement>('cdk-dialog-container button')[1]!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-last-answer]')?.textContent).toContain('confirmado (true)');
    element.remove();
  });

  it('draws the three halos with the component own tokens, and none of them blue', async () => {
    const { element } = await render(ShowroomDialog);
    const halos = [...element.querySelectorAll<HTMLElement>('[data-halo]')];
    expect(halos.length).toBe(3);
    expect(halos[0]?.className).toContain('shadow-(--shadow-halo-danger)');
    expect(halos[2]?.className).toContain('bg-neutral-surface');
    for (const halo of halos) {
      expect(halo.className).not.toContain('primary');
      // The exception the sheet documents: a shape, with nothing inside it.
      expect(halo.querySelector('svg')).toBeNull();
    }
  });

  it('falls back to Info for a tone no row carries, and says nothing for an unknown state', async () => {
    const { fixture } = await render(ShowroomDialog);
    const page = fixture.componentInstance as unknown as {
      rowFor(tone: string): { name: string };
      fact(tone: string, stateId: string): string;
      isHalo(stateId: string): boolean;
      haloClasses(tone: string): string;
    };
    expect(page.rowFor('no-such-tone').name).toBe('Info');
    expect(page.fact('danger', 'confirm')).toBe('Danger');
    expect(page.fact('danger', 'backdrop')).toBe('No cierra');
    expect(page.fact('danger', 'halo')).toBe('');
    expect(page.isHalo('halo')).toBe(true);
    expect(page.isHalo('confirm')).toBe(false);
    expect(page.haloClasses('no-such-tone')).toBe('');
  });
});

describe('ShowroomSearchSelect', () => {
  afterEach(clearOverlays);

  it('renders the real component inside a reactive form', async () => {
    const { element } = await render(ShowroomSearchSelect);
    expect(element.querySelector('[data-demo-search] ewms-search-select')).not.toBeNull();
    expect(element.querySelector('[data-demo-search] input[role="combobox"]')).not.toBeNull();
  });

  it('starts with nothing chosen and nothing asked of the source', async () => {
    const { element } = await render(ShowroomSearchSelect);
    expect(element.querySelector('[data-demo-value]')?.textContent).toBe('(ninguno)');
    expect(element.querySelector('[data-queries]')).toBeNull();
  });

  it('the buttons really change how the source behaves', async () => {
    const { fixture, element } = await render(ShowroomSearchSelect);
    const behaviour = () => element.querySelector('[data-behaviour-value]')?.textContent;

    expect(behaviour()).toBe('normal');

    element.querySelector<HTMLButtonElement>('[data-behaviour="failing"] button')!.click();
    await fixture.whenStable();
    expect(behaviour()).toBe('failing');

    element.querySelector<HTMLButtonElement>('[data-behaviour="slow"] button')!.click();
    await fixture.whenStable();
    expect(behaviour()).toBe('slow');
  });

  it('can make the source stop counting, because total null is legitimate', async () => {
    const { fixture, element } = await render(ShowroomSearchSelect);
    const counts = () => element.querySelector('[data-counts-value]')?.textContent;

    expect(counts()).toContain('total: número');

    element.querySelector<HTMLButtonElement>('[data-toggle-counts] button')!.click();
    await fixture.whenStable();
    expect(counts()).toContain('total: null');
  });

  it('records what the source was asked, and can clear the record', async () => {
    const { fixture } = await render(ShowroomSearchSelect);
    const page = fixture.componentInstance as unknown as {
      source(): { search(query: string, page: number): { subscribe(): void } };
      clearQueries(): void;
      queries(): readonly string[];
    };

    page.source().search('caja', 0).subscribe();
    await fixture.whenStable();
    expect(page.queries()[0]).toContain('«caja»');

    page.clearQueries();
    expect(page.queries().length).toBe(0);
  });

  it('shows a catalogue that is the same on every load', async () => {
    const { element } = await render(ShowroomSearchSelect);
    // Seeded, so the count is a fact about the page and not about luck.
    expect(element.querySelector('[data-block="3-demo"]')?.textContent).toContain('340 artículos');
  });

  it('goes back to normal, and clears the record, from the page itself', async () => {
    const { fixture, element } = await render(ShowroomSearchSelect);

    element.querySelector<HTMLButtonElement>('[data-behaviour="failing"] button')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[data-behaviour="normal"] button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-behaviour-value]')?.textContent).toBe('normal');

    element.querySelector<HTMLButtonElement>('[data-clear-queries] button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-queries]')).toBeNull();
  });

  it('carries the four messages and the two display functions, already in Spanish', async () => {
    const { fixture } = await render(ShowroomSearchSelect);
    const page = fixture.componentInstance as unknown as {
      messages: {
        searching: string;
        noResults(query: string): string;
        error: string;
        retry: string;
        more: string;
        results(count: number, total: number | null): string;
      };
      display: {
        label(article: { code: string; name: string }): string;
        code(article: { code: string }): string;
      };
    };

    expect(page.messages.searching).toBe('Buscando…');
    expect(page.messages.noResults('caja')).toContain('caja');
    expect(page.messages.error).toContain('catálogo');
    expect(page.messages.retry).toBe('Reintentar');
    expect(page.messages.more).toContain('más resultados');

    // The total may be null, and the message is where that shows.
    expect(page.messages.results(3, 340)).toBe('3 de 340 resultados');
    expect(page.messages.results(3, null)).toBe('3 resultados');

    const article = { code: 'SKU-88000', name: 'Caja plegable 60x40' };
    expect(page.display.label(article)).toBe('SKU-88000 · Caja plegable 60x40');
    expect(page.display.code(article)).toBe('SKU-88000');
  });

  it('fills the state matrix from one table of facts', async () => {
    const { fixture } = await render(ShowroomSearchSelect);
    const page = fixture.componentInstance as unknown as {
      fact(variantId: string, stateId: string): string;
      chosenLabel(): string;
    };
    expect(page.fact('error', 'where')).toContain('bajo el campo');
    expect(page.fact('empty', 'value')).toContain('Intacto');
    expect(page.fact('no-such-state', 'where')).toBe('');
    expect(page.fact('error', 'no-such-column')).toBe('');
    expect(page.chosenLabel()).toBe('(ninguno)');
  });
});

/**
 * The table's sheet.
 *
 * The one assertion that matters most is the line count: the API was designed
 * against it, and the page reads it off the DOM so it cannot drift from the
 * snippet it describes.
 */
describe('ShowroomTable', () => {
  it('renders the real table, with three levels available', async () => {
    const { element } = await render(ShowroomTable);
    const grid = element.querySelector('[data-demo-table] table');
    expect(grid?.getAttribute('role')).toBe('treegrid');
    expect(element.querySelectorAll('[data-demo-table] tbody tr').length).toBe(12);
  });

  it('COUNTS THE CONSUMER TEMPLATE OFF THE DOM, and it is under the ceiling', async () => {
    const { element } = await render(ShowroomTable);
    const printed = element.querySelector('[data-template-lines]')?.textContent ?? '';
    const lines = Number(printed);

    expect(Number.isFinite(lines)).toBe(true);
    // The comanda's ceiling. If this ever fails, the API is what needs fixing.
    expect(lines).toBeLessThanOrEqual(40);

    // And the number really is the snippet's, not a number somebody typed.
    const snippet = element.querySelector('[data-consumer-template]')?.textContent ?? '';
    expect(snippet.trimEnd().split('\n').length).toBe(lines);
  });

  it('shows the whole component behind it, and it is two lines', async () => {
    const { element } = await render(ShowroomTable);
    expect(element.querySelector('[data-component-lines]')?.textContent).toBe('2');
  });

  it('the snippet is what the page actually renders', async () => {
    const { element } = await render(ShowroomTable);
    const snippet = element.querySelector('[data-consumer-template]')?.textContent ?? '';
    // Not a paraphrase: every column of the demo is in the snippet.
    for (const key of ['codigo', 'cliente', 'fecha', 'bultos', 'estado']) {
      expect(snippet).toContain(`key="${key}"`);
    }
    expect(snippet).toContain('children="hijos"');
    expect(snippet).toContain('rowState="estado"');
  });

  it('expands a header into its lines, in the same table', async () => {
    const { fixture, element } = await render(ShowroomTable);
    const before = element.querySelectorAll('[data-demo-table] tbody tr').length;

    element.querySelector<HTMLButtonElement>('[data-demo-table] [data-toggle="0"]')!.click();
    await fixture.whenStable();

    expect(element.querySelectorAll('[data-demo-table] tbody tr').length).toBeGreaterThan(before);
    expect(element.querySelectorAll('[data-demo-table] table').length).toBe(1);
  });

  it('changes density for real', async () => {
    const { fixture, element } = await render(ShowroomTable);
    expect(element.querySelector('[data-density-value]')?.textContent).toBe('md');

    element.querySelector<HTMLButtonElement>('[data-density="sm"]')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-density-value]')?.textContent).toBe('sm');
    const row = element.querySelector<HTMLElement>('[data-demo-table] tbody tr');
    expect(row?.style.height).toBe('var(--row-height-sm)');
  });

  it('reports what the last query asked for', async () => {
    const { fixture, element } = await render(ShowroomTable);
    const search = element.querySelector<HTMLInputElement>(
      '[data-demo-table] [data-quick-filter] input',
    )!;
    search.value = 'Andes';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(element.querySelector('[data-query]')?.textContent).toContain('«Andes»');
  });

  it('activates a row with a double click, and says which', async () => {
    const { fixture, element } = await render(ShowroomTable);
    element
      .querySelector('[data-demo-table] tbody tr')!
      .dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await fixture.whenStable();

    expect(element.querySelector('[data-activated]')?.textContent).toContain('cabecera');
  });

  it('paints the four tints and the four badges from one dictionary', async () => {
    const { element } = await render(ShowroomTable);
    const tints = [...element.querySelectorAll('[data-tint]')].map((tint) =>
      tint.getAttribute('data-tint'),
    );
    expect(tints).toEqual(['neutral', 'warning', 'success', 'danger']);
    expect(element.querySelectorAll('[data-block="5-matriz"] ewms-badge').length).toBe(4);
  });

  it('falls back to nothing for a variant no state carries', async () => {
    const { fixture } = await render(ShowroomTable);
    const page = fixture.componentInstance as unknown as {
      tintFor(variant: string): string;
      labelFor(variant: string): string;
      isBadge(stateId: string): boolean;
      consultaResumen(): string;
    };
    expect(page.tintFor('no-such-state')).toBe('');
    expect(page.labelFor('no-such-state')).toBe('');
    expect(page.isBadge('badge')).toBe(true);
    expect(page.isBadge('tint')).toBe(false);
    expect(page.consultaResumen()).toContain('sin búsqueda');
  });

  it('reports the selection, and sorts by clicking a header', async () => {
    const { fixture, element } = await render(ShowroomTable);

    const box = element.querySelector<HTMLInputElement>('[data-demo-table] tbody input')!;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(element.querySelector('[data-selection-count]')?.textContent).toBe('1');

    element.querySelector<HTMLButtonElement>('[data-demo-table] [data-sort="bultos"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-query]')?.textContent).toContain('bultos asc');
  });

  it('goes back to the medium density', async () => {
    const { fixture, element } = await render(ShowroomTable);
    element.querySelector<HTMLButtonElement>('[data-density="sm"]')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[data-density="md"]')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-density-value]')?.textContent).toBe('md');
  });
});

/**
 * The lote D demos of the Tabla sheet: the detail panel, the row menu, the
 * children that arrive late and the windowed demo's own lazy loading.
 *
 * They live inside the demo block rather than in a block of their own: every
 * sheet in the catalogue carries the same eight blocks, and a sheet with a
 * ninth is a sheet that has to be learnt separately.
 */
describe('ShowroomTable — composición avanzada', () => {
  const DETALLE = '[data-demo-detalle]';

  it('offers the detail panel on the headers, and the panel is projected', async () => {
    const { fixture, element } = await render(ShowroomTable);

    const toggle = element.querySelector<HTMLButtonElement>(
      `${DETALLE} [data-detail-toggle="0"] button`,
    );
    expect(toggle).not.toBeNull();

    toggle!.click();
    await fixture.whenStable();

    const panel = element.querySelector(`${DETALLE} [data-detail="0"]`);
    expect(panel?.textContent).toContain('Bultos totales');
    expect(panel?.querySelector('button')?.textContent).toContain('Descargar');
  });

  it('writes down the download instead of pretending to serve one', async () => {
    const { fixture, element } = await render(ShowroomTable);
    element.querySelector<HTMLButtonElement>(`${DETALLE} [data-detail-toggle="0"] button`)!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-download]')?.textContent).toContain('(ninguna)');
    element.querySelector<HTMLButtonElement>(`${DETALLE} [data-detail] button`)!.click();
    await fixture.whenStable();

    // No hay backend, y una demo que abriera un PDF estaría enseñando uno.
    expect(element.querySelector('[data-download]')?.textContent).toContain('EXP-');
  });

  it('opens the row menu from the kebab and reports what was chosen', async () => {
    const { fixture, element } = await render(ShowroomTable);

    element.querySelector<HTMLButtonElement>(`${DETALLE} [data-kebab="0"] button`)!.click();
    await fixture.whenStable();

    const menu = document.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.querySelectorAll('[role="menuitem"]').length).toBe(4);

    menu!.querySelector<HTMLElement>('[data-menu-item="duplicar"]')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-menu-choice]')?.textContent).toContain('Duplicar');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('keeps the disabled entry visible and out of reach', async () => {
    const { fixture, element } = await render(ShowroomTable);
    element.querySelector<HTMLButtonElement>(`${DETALLE} [data-kebab="0"] button`)!.click();
    await fixture.whenStable();

    const entry = document.querySelector('[data-menu-item="imprimir"]');
    expect(entry).not.toBeNull();
    expect(entry?.getAttribute('aria-disabled')).toBe('true');

    entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    expect(element.querySelector('[data-menu-choice]')?.textContent).toContain('(ninguna)');
  });

  it('asks for the children only when a header is opened', async () => {
    const { fixture, element } = await render(ShowroomTable);
    const demo = '[data-demo-perezosa]';

    // El toggle está ahí aunque los hijos no hayan llegado: devolver un
    // Observable ES decir que hay hijos.
    const toggle = element.querySelector<HTMLButtonElement>(`${demo} [data-toggle="0"]`);
    expect(toggle).not.toBeNull();

    toggle!.click();
    await fixture.whenStable();
    expect(element.querySelector(`${demo} [data-loading="0"]`)).not.toBeNull();
  });

  it('does not build five thousand rows until they are asked for', async () => {
    const { element } = await render(ShowroomTable);

    // La ficha abre con una muestra. Que al pulsar el botón lleguen las cinco
    // mil y la ventana siga dibujando un puñado se comprueba en el navegador
    // (e2e): aquí no hay hoja de estilos, así que no hay altura de fila, así
    // que no hay ventana -- y cinco mil filas en jsdom son cinco mil filas.
    expect(element.querySelector('[data-loaded-count]')?.textContent).toContain('60');
    expect(element.querySelector<HTMLButtonElement>('[data-load-all]')?.disabled).toBe(false);
    expect(element.querySelector('[data-load-all]')?.textContent).toContain('5000');
  });
});

describe('ShowroomNavigation', () => {
  /**
   * THE ONE CLAIM THIS PAGE MAKES: the three pieces are presentational and the
   * state lives OUTSIDE them, in whoever composes. Every assertion below is
   * that claim from a different side -- choose in the rail and the tabs and
   * the crumbs move; choose a tab and the rail moves; close a tab and the
   * neighbour takes over.
   *
   * There is no router in this page, and that is also the demonstration: a
   * piece that imported one could not be shown here at all.
   */
  function rail(element: HTMLElement, id: string): HTMLButtonElement {
    return element.querySelector(`[data-nav-item="${id}"]`) as HTMLButtonElement;
  }

  function tab(element: HTMLElement, id: string): HTMLButtonElement {
    return element.querySelector(`[data-tab="${id}"]`) as HTMLButtonElement;
  }

  it('choosing in the rail moves the crumbs AND opens a tab', async () => {
    const { fixture, element } = await render(ShowroomNavigation);

    rail(element, 'catalogs').click();
    await fixture.whenStable();
    rail(element, 'clients').click();
    await fixture.whenStable();

    expect(element.querySelector('[data-demo-active]')?.textContent?.trim()).toBe('clients');
    expect(tab(element, 'clients')).not.toBeNull();
    expect(element.querySelector('ewms-breadcrumbs')?.textContent).toContain('Catálogos');
  });

  it('a group opens instead of navigating', async () => {
    const { fixture, element } = await render(ShowroomNavigation);
    const before = element.querySelector('[data-demo-active]')?.textContent?.trim();

    rail(element, 'catalogs').click();
    await fixture.whenStable();

    expect(element.querySelector('[data-demo-active]')?.textContent?.trim()).toBe(before);
    expect(rail(element, 'catalogs').getAttribute('aria-expanded')).toBe('true');
  });

  it('choosing a TAB moves the rail: one state, two controls', async () => {
    const { fixture, element } = await render(ShowroomNavigation);

    tab(element, 'dashboard').click();
    await fixture.whenStable();

    expect(element.querySelector('[data-demo-active]')?.textContent?.trim()).toBe('dashboard');
    expect(rail(element, 'dashboard').getAttribute('aria-current')).toBe('page');
  });

  it('closing the active tab hands over to the NEIGHBOUR', async () => {
    const { fixture, element } = await render(ShowroomNavigation);

    element.querySelector<HTMLElement>('[data-tab-close="articles"]')!.click();
    await fixture.whenStable();

    expect(tab(element, 'articles')).toBeNull();
    expect(element.querySelector('[data-demo-active]')?.textContent?.trim()).toBe('dashboard');
  });

  it('closing a tab that is NOT active leaves the selection alone', async () => {
    const { fixture, element } = await render(ShowroomNavigation);

    rail(element, 'dashboard').click();
    await fixture.whenStable();
    element.querySelector<HTMLElement>('[data-tab-close="articles"]')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-demo-active]')?.textContent?.trim()).toBe('dashboard');
  });

  it('closing every closable tab leaves the one that says it cannot be closed', async () => {
    // `closable: false` is the exception and it is written down, so this is
    // the end of the close chain on this page: Dashboard stays.
    const { fixture, element } = await render(ShowroomNavigation);

    element.querySelector<HTMLElement>('[data-tab-close="articles"]')!.click();
    await fixture.whenStable();

    // The document strip only. The page also renders a `section` strip below,
    // which is a different control demonstrating a different mode.
    const documentTabs = [...element.querySelectorAll('[data-block="3-demo"] [data-tab]')].map(
      (tab) => tab.textContent?.trim(),
    );

    expect(documentTabs).toEqual(['Dashboard']);
    expect(element.querySelector('[data-tab-close="dashboard"]')).toBeNull();
  });

  it('the rail asks for the other width and the page grants it', async () => {
    const { fixture, element } = await render(ShowroomNavigation);
    expect(rail(element, 'dashboard').textContent?.trim()).toBe('Dashboard');

    element.querySelector<HTMLButtonElement>('[data-nav-rail-toggle]')!.click();
    await fixture.whenStable();

    // Collapsed: the labels go, the destinations stay.
    expect(rail(element, 'dashboard')).not.toBeNull();
    expect(rail(element, 'dashboard').textContent?.trim()).toBe('');
  });

  it('a crumb reports itself and the page says which: a miga does not navigate', async () => {
    const { fixture, element } = await render(ShowroomNavigation);

    element.querySelector<HTMLButtonElement>('[data-crumb="Catálogos"]')!.click();
    await fixture.whenStable();

    expect(element.textContent).toContain('Última miga elegida');
  });

  it('the deep trail is folded, and the fold is a button that says how much it hides', async () => {
    const { element } = await render(ShowroomNavigation);
    const fold = element.querySelector('[data-crumb-fold]');

    expect(fold).not.toBeNull();
    expect(fold?.getAttribute('aria-label')).toContain('niveles ocultos');
  });

  it('shows the bottom bar with its cost written down, not hidden', async () => {
    const { element } = await render(ShowroomNavigation);

    expect(element.querySelector('[data-nav-bottom]')).not.toBeNull();
    expect(element.textContent).toContain('dos toques');
  });

  it('THE COST OF THE BOTTOM BAR, WALKED: «Más» and then the destination', async () => {
    const { fixture, element } = await render(ShowroomNavigation);

    element.querySelector<HTMLButtonElement>('[data-nav-bottom-more]')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[data-nav-sheet-item="clients"]')!.click();
    await fixture.whenStable();

    // Two taps for a second-level screen, against one on the rail. The page
    // says so in words; this is the same claim as a test.
    expect(element.querySelector('[data-demo-active]')?.textContent?.trim()).toBe('clients');
  });

  it('the section tabs move on their own, without touching the document strip', async () => {
    const { fixture, element } = await render(ShowroomNavigation);
    const before = element.querySelector('[data-demo-active]')?.textContent?.trim();

    element.querySelector<HTMLButtonElement>('[data-tab="history"]')!.click();
    await fixture.whenStable();

    expect(element.querySelector('[data-tab="history"]')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(element.querySelector('[data-demo-active]')?.textContent?.trim()).toBe(before);
  });
});

describe('ShowroomPagination', () => {
  it('moves between pages and reports the zero-based value', async () => {
    const { fixture, element } = await render(ShowroomPagination);
    expect(element.querySelector('[data-page-value]')?.textContent).toContain('page = 0');

    element.querySelector<HTMLButtonElement>('[data-next-page] button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-page-value]')?.textContent).toContain('page = 1');

    element.querySelector<HTMLButtonElement>('[data-previous-page] button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-page-value]')?.textContent).toContain('page = 0');
  });

  it('says nothing about a total the source does not know', async () => {
    const { fixture, element } = await render(ShowroomPagination);
    expect(element.querySelector('[data-demo-pagination]')?.textContent).toContain('filas');

    element.querySelector<HTMLButtonElement>('[data-toggle-total]')!.click();
    await fixture.whenStable();
    expect(element.querySelector('[data-demo-pagination]')?.textContent).not.toContain('filas');
  });

  it('reads the same dictionary as the table', async () => {
    const { element } = await render(ShowroomPagination);
    // Los textos salen de EWMS_TABLE_MESSAGES, que el catálogo provee una vez.
    expect(element.querySelector('[data-page-label]')?.textContent).toContain('Página 1 de 7');
  });
});

/**
 * The two pattern pages of DS-4, beyond the eight blocks the loop above
 * already checks.
 *
 * What is asserted here is what a DOM alone can answer: that the page reads
 * its numbers from the one place that owns them, and that it does not write
 * them down a second time. The COUNTS themselves -- how many clicks a flow
 * really costs -- need a browser with a pointer, and live in
 * e2e/click-budget.e2e.ts.
 */
describe('ShowroomSearchCreateEdit', () => {
  it('shows the four budgets, and shows the numbers the constants hold', async () => {
    const { element } = await render(ShowroomSearchCreateEdit);
    const shown = [...element.querySelectorAll('[data-budget]')].map((row) => ({
      id: row.getAttribute('data-budget'),
      max: Number(row.querySelector('[data-budget-max]')?.textContent?.trim()),
    }));

    expect(shown).toEqual(FLOW_BUDGETS.map((budget) => ({ id: budget.id, max: budget.max })));
  });

  /*
   * HG-02 -- "the numbers are not written twice" -- IS NOT CHECKED HERE.
   *
   * It is a claim about the SOURCE, and a jsdom spec can only see what a page
   * rendered: a template with a 2 typed into it renders exactly like one that
   * read the 2 from the constant. So the scan lives with the other source
   * gates, in tools/ci/check-click-budget.mjs, which `npm test` runs. What
   * this file asserts is the half a DOM can answer -- that what is on screen
   * equals what the constants hold, which is the test above.
   */

  it('gives Nuevo a visible button and not only a shortcut (WCAG 2.1.1)', async () => {
    const { element } = await render(ShowroomSearchCreateEdit);
    expect(element.querySelector('[data-new-button] button')).not.toBeNull();
  });

  it('will not offer to edit when nothing is chosen', async () => {
    const { element } = await render(ShowroomSearchCreateEdit);
    const edit = element.querySelector<HTMLButtonElement>('[data-edit-button] button');
    /*
     * The NATIVE attribute, not `aria-disabled`. `ewms-button` binds
     * `[disabled]` to the real property and reserves `aria-disabled` for
     * Loading, where the control must stay focusable -- so asserting the ARIA
     * one here passed vacuously against `null` until it was checked.
     */
    expect(edit?.disabled).toBe(true);
  });

  it('does not count its own scaffolding as part of a flow', async () => {
    const { element } = await render(ShowroomSearchCreateEdit);
    // The reset and the break-the-source switch are marked, so that using the
    // demo never costs the demo's own budget.
    expect(element.querySelectorAll('[data-not-a-flow-click]').length).toBe(2);
  });
});

describe('ShowroomKeyboard', () => {
  it('names every outcome the engine can reach, and none it cannot', async () => {
    const { element } = await render(ShowroomKeyboard);
    const rows = [...element.querySelectorAll('[data-block="5-matriz"] tbody th')].map((cell) =>
      cell.textContent?.trim(),
    );

    // Nine, because `handle` has nine ways out. A page listing eight would be
    // a page hiding the branch somebody most needs explained.
    expect(rows).toEqual([
      'already-handled',
      'burst',
      'scan',
      'key',
      'in-text-field',
      'single-key-off',
      'unregistered',
      'deferred',
      'shortcut',
    ]);
  });

  it('says so when no root layout has mounted the engine', async () => {
    /*
     * A page rendered on its own in a test bed has no root layout above it, so
     * there is no map to dispatch against. The page SAYS that rather than
     * drawing an empty table that looks like a broken map.
     */
    const { element } = await render(ShowroomKeyboard);
    expect(element.querySelector('[data-demo-keyboard]')?.textContent).toContain(
      'Ningún layout raíz montó el motor',
    );
    expect(element.querySelectorAll('[data-demo-bindings] tr').length).toBe(0);
  });
});
