import { provideZonelessChangeDetection, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expectNoAxeViolations } from '@ewms/testing';
import { ShowroomLayout } from '../layout/showroom-layout';
import { ShowroomButton } from './components/button';
import { ShowroomCheckbox } from './components/checkbox';
import { ShowroomIconButton } from './components/icon-button';
import { ShowroomInput } from './components/input';
import { ShowroomRadio } from './components/radio';
import { ShowroomSelect } from './components/select';
import { ShowroomText } from './components/text';
import { ShowroomToggle } from './components/toggle';
import { ShowroomTooltip } from './components/tooltip';
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
async function render<T>(component: Type<T>) {
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([])],
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

    search!.value = 'toggle';
    search!.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(count()).toBe(1);

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
    expect(element.querySelector('[data-entry="table"] a')).toBeNull();
    expect(element.querySelector('[data-entry="table"]')?.textContent).toContain('(pendiente)');
  });

  it('records that the App Shell is deliberately not exhibited', async () => {
    const { element } = await render(ShowroomHome);
    expect(element.textContent).toContain('El App Shell no se exhibe');
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

  it('keeps the eFLOW exception on the page, and says it is not a precedent', async () => {
    const { element } = await render(ShowroomBrand);
    expect(element.textContent).toContain('no habilita usar negro acá');
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

  it('writes down the rule that the blue is only ever action', async () => {
    const { element } = await render(ShowroomColors);
    expect(element.textContent).toContain('se hace clic');
    expect(element.textContent).toContain('No existe familia');
  });

  it('keeps the deliberately unused brand blue on the page with its reason', async () => {
    const { element } = await render(ShowroomColors);
    expect(element.textContent).toContain('No borrarlo por parecer muerto');
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

  it('records that there is no escape hatch from the heading level', async () => {
    const { element } = await render(ShowroomTypography);
    expect(element.textContent).toContain('no existe una prop');
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

  it('marks the control radius as the signature of the system', async () => {
    const { element } = await render(ShowroomSpacing);
    const signature = element.querySelector('[data-radius="--radius-control"]');
    expect(signature?.textContent).toContain('Firma visual del sistema');
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

  it('says when NOT to use the component, which is the block that stops misuse', async () => {
    const { element } = await render(ShowroomButton);
    const block = element.querySelector('[data-block="2-proposito"]');
    expect(block?.textContent).toContain('Si navega, es un link');
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

  it('documents that the component has no click output, against the real signature', async () => {
    const { element } = await render(ShowroomButton);
    const contract = element.querySelector('[data-block="8-contrato"]');
    expect(contract?.textContent).toContain('Ninguna.');
    expect(contract?.textContent).toContain('Gana el código');
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
];

describe.each(SHEETS)('$name', ({ component, heading }) => {
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

  it('has no accessibility violations', async () => {
    const { element } = await render(component);
    await expectNoAxeViolations(element);
  });
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

  it('declares the Focus hole in the matrix instead of faking a cell', async () => {
    const { element } = await render(ShowroomInput);
    expect(element.querySelector('[data-block="5-matriz"]')?.textContent).toContain(
      'Falta Focus, y falta a propósito',
    );
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

  it('documents the keyboard the component really has, and the gap', async () => {
    const { element } = await render(ShowroomSelect);
    const contract = element.querySelector('[data-block="8-contrato"]')?.textContent ?? '';
    expect(contract).toContain('Escape');
    // The ficha lists typeahead as pending and the code has none: the page
    // says so rather than describing a keyboard the component does not have.
    expect(contract).toContain('No hay Home / End');
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

  it('writes down the disabled rule, which is what surprises newcomers most', async () => {
    const { element } = await render(ShowroomCheckbox);
    expect(element.querySelector('[data-block="8-contrato"]')?.textContent).toContain(
      'Quien deshabilita gana, y nadie re-habilita',
    );
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

  it('records that a radio has no third state, which is the difference', async () => {
    const { element } = await render(ShowroomRadio);
    expect(element.querySelector('[data-block="4-variantes"]')?.textContent).toContain(
      'tampoco hay un tercer valor',
    );
  });

  it('writes down the disabled rule too', async () => {
    const { element } = await render(ShowroomRadio);
    expect(element.querySelector('[data-block="8-contrato"]')?.textContent).toContain(
      'Quien deshabilita gana, y nadie re-habilita',
    );
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

  it('writes down the disabled rule as well', async () => {
    const { element } = await render(ShowroomToggle);
    expect(element.querySelector('[data-block="8-contrato"]')?.textContent).toContain(
      'Quien deshabilita gana, y nadie re-habilita',
    );
  });
});
