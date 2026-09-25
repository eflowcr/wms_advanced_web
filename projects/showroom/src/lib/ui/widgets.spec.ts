import { Component, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations, provideI18nTesting } from '@ewms/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SHOWROOM_SCOPE } from '../catalog';
import { loadShowroomScope, SHOWROOM_DICTIONARIES, useSpanishBrowser } from '../showroom.testing';
import { DemoFrame } from './demo-frame';
import { PropTable, type PropRow } from './prop-table';
import { parseProse, Prose } from './prose';
import { StateMatrix, type MatrixAxis } from './state-matrix';
import { TokenValue } from './token-value';
import { translated } from './translated';

// Los widgets traducen las claves que reciben: se montan con los diccionarios reales, en español.
async function render<T>(component: Type<T>) {
  useSpanishBrowser();
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [provideI18nTesting(SHOWROOM_DICTIONARIES)],
  }).compileComponents();
  await loadShowroomScope();
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

afterEach(() => vi.restoreAllMocks());

describe('DemoFrame', () => {
  @Component({
    imports: [DemoFrame],
    template: `
      <ewms-demo-frame [ground]="ground()" [label]="label()">
        <p>contenido</p>
      </ewms-demo-frame>
    `,
  })
  class Host {
    readonly ground = signal<'canvas' | 'surface' | 'navy'>('canvas');
    readonly label = signal('');
  }

  it('projects its content and defaults to the canvas ground', async () => {
    const { element } = await render(Host);
    expect(element.textContent).toContain('contenido');
    expect(element.querySelector('div')?.className).toContain('bg-canvas');
  });

  it('paints the navy ground with the on-dark text role', async () => {
    const { fixture, element } = await render(Host);
    fixture.componentInstance.ground.set('navy');
    await fixture.whenStable();
    const classes = element.querySelector('div')?.className ?? '';
    expect(classes).toContain('bg-brand-navy');
    expect(classes).toContain('text-on-dark');
  });

  it('paints the surface ground', async () => {
    const { fixture, element } = await render(Host);
    fixture.componentInstance.ground.set('surface');
    await fixture.whenStable();
    expect(element.querySelector('div')?.className).toContain('bg-surface');
  });

  it('shows a caption only when it is given one', async () => {
    const { fixture, element } = await render(Host);
    expect(element.querySelector('p')?.textContent).toBe('contenido');

    fixture.componentInstance.label.set('Sobre navy');
    await fixture.whenStable();
    expect(element.textContent).toContain('Sobre navy');
  });
});

describe('TokenValue', () => {
  let style: HTMLStyleElement;

  @Component({
    imports: [TokenValue],
    template: ` <ewms-token-value [token]="token()" [swatch]="swatch()" [pending]="pending()" /> `,
  })
  class Host {
    readonly token = signal('--color-text-primary');
    readonly swatch = signal(false);
    readonly pending = signal(false);
  }

  beforeEach(() => {
    style = document.createElement('style');
    style.textContent =
      ':root { --tone-7: navy; --color-text-primary: var(--tone-7);' +
      ' --a-shadow: 0 0 0 2q var(--color-text-primary), 0 0 0 5q var(--tone-7); }';
    document.head.appendChild(style);
  });

  afterEach(() => style.remove());

  it('shows the token and the chain down to its primitive', async () => {
    const { element } = await render(Host);
    const text = element.textContent ?? '';
    expect(text).toContain('--color-text-primary');
    expect(text).toContain('--tone-7');
  });

  it('draws a swatch only when asked, and only when the value is a colour', async () => {
    const { fixture, element } = await render(Host);
    expect(element.querySelector('[data-swatch]')).toBeNull();

    fixture.componentInstance.swatch.set(true);
    await fixture.whenStable();
    const chip = element.querySelector<HTMLElement>('[data-swatch]');
    expect(chip?.style.backgroundColor).toBe('var(--color-text-primary)');

    // Un token que no es color no lleva muestra: una caja vacía se leería como «color en blanco».
    fixture.componentInstance.token.set('--not-a-colour');
    await fixture.whenStable();
    expect(element.querySelector('[data-swatch]')).toBeNull();
  });

  it('gives no chip to a composite, however colour-like it looks', async () => {
    const { fixture, element } = await render(Host);
    fixture.componentInstance.token.set('--a-shadow');
    fixture.componentInstance.swatch.set(true);
    await fixture.whenStable();
    // Dos colores y dos longitudes: el parser la acepta solo porque contiene var(), la trampa a evitar.
    expect(element.querySelector('[data-swatch]')).toBeNull();
  });

  it('says loudly when a token is missing', async () => {
    const { fixture, element } = await render(Host);
    fixture.componentInstance.token.set('--color-not-declared');
    await fixture.whenStable();
    expect(element.textContent).toContain('falta en tokens.css');
  });

  it('says "pendiente" instead when the gap is a known one', async () => {
    const { fixture, element } = await render(Host);
    fixture.componentInstance.token.set('--text-mono-weight');
    fixture.componentInstance.pending.set(true);
    await fixture.whenStable();
    expect(element.textContent).toContain('(pendiente)');
    expect(element.textContent).not.toContain('falta en tokens.css');
  });
});

describe('PropTable', () => {
  const rows: readonly PropRow[] = [
    {
      name: 'position',
      type: "'top'",
      default: "'top'",
      description: 'showroom.tooltip.props.position',
    },
    {
      name: 'describes',
      type: 'boolean',
      default: 'false',
      description: 'showroom.tooltip.props.describes',
    },
  ];

  @Component({
    imports: [PropTable],
    template: `<ewms-prop-table [rows]="rows" caption="Propiedades" />`,
  })
  class Host {
    readonly rows = rows;
  }

  it('renders a row per property, with a header for each column', async () => {
    const { element } = await render(Host);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(element.querySelectorAll('thead th')).toHaveLength(4);
    expect(element.querySelector('caption')?.textContent?.trim()).toBe('Propiedades');
    const headers = [...element.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Propiedad', 'Tipo', 'Default', 'Qué hace']);
    expect(element.textContent).toContain('Colocación preferida.');
  });

  it('writes the description with its marks: code is code', async () => {
    const { element } = await render(Host);
    const description = element.querySelectorAll('tbody tr')[1]?.lastElementChild;
    const code = [...(description?.querySelectorAll('code') ?? [])].map((c) => c.textContent);
    expect(code).toContain('aria-describedby');
    expect(description?.textContent).not.toContain('<code>');
  });

  it('has no accessibility violations', async () => {
    const { element } = await render(Host);
    await expectNoAxeViolations(element);
  });
});

describe('StateMatrix', () => {
  const variants: readonly MatrixAxis[] = [
    { id: 'primary', label: 'showroom.common.sizes.sm' },
    { id: 'ghost', label: 'showroom.common.sizes.lg' },
  ];
  const states: readonly MatrixAxis[] = [
    { id: 'default', label: 'showroom.common.states.default' },
    { id: 'hover', label: 'showroom.common.states.hover' },
    { id: 'focus', label: 'showroom.common.states.focus' },
  ];

  @Component({
    imports: [StateMatrix],
    template: `
      <ewms-state-matrix [variants]="variants" [states]="states" caption="Matriz">
        <ng-template let-variant="variant" let-state="state">
          <span class="cell">{{ variant.id }}/{{ state.id }}</span>
        </ng-template>
      </ewms-state-matrix>
    `,
  })
  class Host {
    readonly variants = variants;
    readonly states = states;
  }

  it('renders a cell for every variant crossed with every state', async () => {
    const { element } = await render(Host);
    const cells = [...element.querySelectorAll('.cell')].map((cell) => cell.textContent);
    expect(cells).toEqual([
      'primary/default',
      'primary/hover',
      'primary/focus',
      'ghost/default',
      'ghost/hover',
      'ghost/focus',
    ]);
  });

  it('names the rows and the columns, so it reads as a table and not as a grid of pictures', async () => {
    const { element } = await render(Host);
    const columns = [...element.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(columns).toEqual(['Variante', 'Default', 'Hover', 'Focus']);
    const rows = [...element.querySelectorAll('tbody th')].map((th) => th.textContent?.trim());
    expect(rows).toEqual(['Small', 'Large']);
  });

  it('has no accessibility violations', async () => {
    const { element } = await render(Host);
    await expectNoAxeViolations(element);
  });
});

describe('Prose', () => {
  it('reads plain text as one text node', () => {
    expect(parseProse('Sin marcas.')).toEqual({
      nodes: [{ kind: 'text', text: 'Sin marcas.' }],
      errors: [],
    });
  });

  it('turns each mark into its node, and keeps the spaces the text brings', () => {
    const { nodes, errors } = parseProse(
      'Pulse <kbd>Esc</kbd> y <b>cierra <code>ewms-dialog</code></b>, <i>sin</i> <mono>1.2</mono>.',
    );
    expect(errors).toEqual([]);
    expect(nodes).toEqual([
      { kind: 'text', text: 'Pulse ' },
      { kind: 'kbd', text: 'Esc' },
      { kind: 'text', text: ' y ' },
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'cierra ' },
          { kind: 'code', text: 'ewms-dialog' },
        ],
      },
      { kind: 'text', text: ', ' },
      { kind: 'em', children: [{ kind: 'text', text: 'sin' }] },
      { kind: 'text', text: ' ' },
      { kind: 'mono', text: '1.2' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('keeps everything inside code literal, markup included', () => {
    expect(parseProse('<code><ewms-table></code> y <code><b></code>').nodes).toEqual([
      { kind: 'code', text: '<ewms-table>' },
      { kind: 'text', text: ' y ' },
      { kind: 'code', text: '<b>' },
    ]);
  });

  it('shows a mark without its closing tag as text, and says so', () => {
    const { nodes, errors } = parseProse('Uno <b>dos');
    expect(nodes).toEqual([
      { kind: 'text', text: 'Uno ' },
      { kind: 'text', text: '<b>dos' },
    ]);
    expect(errors).toEqual(['<b> without </b>']);
  });

  it('flattens an emphasis inside another one, and says so', () => {
    const { nodes, errors } = parseProse('<b>uno <i>dos</i></b>');
    expect(nodes).toEqual([
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'uno ' },
          { kind: 'text', text: 'dos' },
        ],
      },
    ]);
    expect(errors).toEqual(['<i> inside another emphasis']);
  });

  // Una marca rota en el diccionario se vería como texto crudo en una sola página: acá falla antes.
  it('finds no broken mark in any text of the catalogue dictionary', () => {
    const texts = (node: unknown, path: string): [string, string][] =>
      typeof node === 'string'
        ? [[path, node]]
        : Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
            texts(v, path + '.' + k),
          );
    const dictionaries = [
      ['es', SHOWROOM_DICTIONARIES[`${SHOWROOM_SCOPE}/es`]],
      ['en', SHOWROOM_DICTIONARIES[`${SHOWROOM_SCOPE}/en`]],
    ] as const;
    const broken = dictionaries.flatMap(([lang, dictionary]) =>
      texts(dictionary, lang)
        .map(([path, text]) => [path, parseProse(text).errors] as const)
        .filter(([, errors]) => errors.length > 0),
    );
    expect(broken).toEqual([]);
  });

  @Component({
    imports: [Prose],
    template: `<p [ewmsProse]="text()"></p>`,
  })
  class Host {
    readonly text = signal('Pulse <kbd>Esc</kbd> para <b>cerrar <code>ewms-dialog</code></b>.');
  }

  it('builds the elements, without innerHTML and without adding a space', async () => {
    const { element } = await render(Host);
    const paragraph = element.querySelector('p');
    expect(paragraph?.textContent).toBe('Pulse Esc para cerrar ewms-dialog.');
    expect(paragraph?.querySelector('kbd')?.textContent).toBe('Esc');
    expect(paragraph?.querySelector('strong code')?.textContent).toBe('ewms-dialog');
  });

  it('follows its text', async () => {
    const { fixture, element } = await render(Host);
    fixture.componentInstance.text.set('<i>otro</i>');
    await fixture.whenStable();
    expect(element.querySelector('p em')?.textContent).toBe('otro');
    expect(element.querySelector('p strong')).toBeNull();
  });
});

describe('translated', () => {
  it('builds its value with the texts of the language on screen, and follows a change', async () => {
    useSpanishBrowser();
    TestBed.configureTestingModule({ providers: [provideI18nTesting(SHOWROOM_DICTIONARIES)] });
    await loadShowroomScope();
    const value = TestBed.runInInjectionContext(() =>
      translated((translate) => ({ label: translate('showroom.common.sections.demo') })),
    );
    expect(value().label).toBe('Demo principal');

    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load(`${SHOWROOM_SCOPE}/en`));
    transloco.setActiveLang('en');

    expect(value().label).toBe('Main demo');
  });
});
