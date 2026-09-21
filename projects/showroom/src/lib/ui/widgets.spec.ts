import { Component, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { DemoFrame } from './demo-frame';
import { PropTable, type PropRow } from './prop-table';
import { StateMatrix, type MatrixAxis } from './state-matrix';
import { TokenValue } from './token-value';

async function render<T>(component: Type<T>) {
  await TestBed.configureTestingModule({ imports: [component] }).compileComponents();
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

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
    { name: 'variant', type: "'primary'", default: "'primary'", description: 'El énfasis.' },
    { name: 'size', type: "'md'", default: "'md'", description: 'La altura.' },
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
    expect(element.textContent).toContain('El énfasis.');
  });

  it('has no accessibility violations', async () => {
    const { element } = await render(Host);
    await expectNoAxeViolations(element);
  });
});

describe('StateMatrix', () => {
  const variants: readonly MatrixAxis[] = [
    { id: 'primary', label: 'Primary' },
    { id: 'ghost', label: 'Ghost' },
  ];
  const states: readonly MatrixAxis[] = [
    { id: 'default', label: 'Default' },
    { id: 'hover', label: 'Hover' },
    { id: 'focus', label: 'Focus' },
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
    expect(rows).toEqual(['Primary', 'Ghost']);
  });

  it('has no accessibility violations', async () => {
    const { element } = await render(Host);
    await expectNoAxeViolations(element);
  });
});
