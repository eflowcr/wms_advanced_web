import { Component, signal, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import { Subject, type Observable } from 'rxjs';
import type { FieldSize } from '../field/field.types';
import { Select, type SelectMessages } from './select';
import type { SearchPage, SearchSource } from './search-source';
import {
  DELAY_SEARCH_INPUT_TOKEN,
  EWMS_SELECT_MESSAGES,
  SCAN_THRESHOLD_TOKEN,
  TIMEOUT_SEARCH_TOKEN,
  type SelectOption,
} from './select.types';

const WAREHOUSES: readonly SelectOption[] = [
  { label: 'Bodega central', value: 'BC' },
  { label: 'Bodega norte', value: 'BN' },
  { label: 'Bodega sur', value: 'BS' },
];

interface Article {
  readonly code: string;
  readonly name: string;
}

const CATALOGUE: readonly Article[] = [
  { code: 'SKU-88213', name: 'Caja plegable 60x40' },
  { code: 'SKU-88214', name: 'Caja plegable 80x60' },
  { code: 'SKU-90001', name: 'Film estirable 23 micras' },
];

const MESSAGES: SelectMessages = {
  searching: 'Buscando…',
  noResults: (query) => `Sin resultados para «${query}»`,
  error: 'No se pudo consultar el catálogo',
  retry: 'Reintentar',
  more: 'Ver más resultados',
  results: (count, total) => (total === null ? `${count} resultados` : `${count} de ${total}`),
};

/** Nada resuelve hasta que la prueba lo dice; un subject por llamada (PACQ-01.2). */
class ControlledSource implements SearchSource<Article> {
  readonly calls: { query: string; page: number }[] = [];
  private readonly pending: Subject<SearchPage<Article>>[] = [];

  search(query: string, page: number): Observable<SearchPage<Article>> {
    this.calls.push({ query, page });
    const subject = new Subject<SearchPage<Article>>();
    this.pending.push(subject);
    return subject;
  }

  /** `fromEnd` cuenta desde el final: 0 es la más reciente. */
  resolve(items: readonly Article[], extra: Partial<SearchPage<Article>> = {}, fromEnd = 0): void {
    const subject = this.pending[this.pending.length - 1 - fromEnd];
    subject?.next({ items, page: 0, pageSize: 20, total: items.length, hasMore: false, ...extra });
    subject?.complete();
  }

  fail(): void {
    this.pending.at(-1)?.error(new Error('boom'));
  }
}

const listbox = () =>
  document.querySelector<HTMLElement>('.cdk-overlay-container [role="listbox"]');
const rows = () => [...document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')];
const row = (index: number): HTMLElement => rows()[index] ?? document.createElement('li');

/** Monta un anfitrión con los textos provistos, como se usa el componente, y sus ayudantes. */
async function mount<H>(type: Type<H>) {
  await TestBed.configureTestingModule({
    imports: [type],
    providers: [{ provide: EWMS_SELECT_MESSAGES, useValue: MESSAGES }],
  }).compileComponents();
  const fixture = TestBed.createComponent(type);
  document.body.appendChild(fixture.nativeElement);
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const field = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('[role="combobox"]') as HTMLInputElement;
  const press = async (name: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
    field().dispatchEvent(event);
    await settle();
    return event;
  };
  await settle();
  return { fixture, host: fixture.componentInstance, settle, field, press };
}

function unmount(fixture: ComponentFixture<unknown>): void {
  fixture.nativeElement.remove();
  document.querySelectorAll('.cdk-overlay-container').forEach((container) => container.remove());
}

@Component({
  template: `
    <ewms-select
      [options]="options()"
      [size]="size()"
      [label]="'Bodega'"
      [hideLabel]="hideLabel()"
      [placeholder]="'Elegir bodega'"
      [hint]="hint()"
      [error]="error()"
      [formField]="bodega"
    />
  `,
  imports: [Select, FormField],
})
class ListHost {
  readonly options = signal<readonly SelectOption[]>(WAREHOUSES);
  readonly size = signal<FieldSize>('md');
  readonly hideLabel = signal(false);
  readonly hint = signal('');
  readonly error = signal(false);
  readonly locked = signal(false);
  readonly model = signal<{ bodega: string | null }>({ bodega: null });
  readonly form = form(this.model, (path) => {
    disabled(path.bodega, () => this.locked());
  });
  readonly bodega = this.form.bodega;
}

describe('Select, options in memory', () => {
  let fixture: ComponentFixture<ListHost>;
  let host: ListHost;
  let settle: () => Promise<void>;
  let field: () => HTMLInputElement;
  let press: (name: string) => Promise<KeyboardEvent>;

  beforeEach(async () => {
    ({ fixture, host, settle, field, press } = await mount(ListHost));
  });

  afterEach(() => unmount(fixture));

  async function openPanel(): Promise<void> {
    field().focus();
    field().click();
    await settle();
  }

  it('is always a text combobox with a chevron, labelled by for/id', () => {
    expect(field().tagName).toBe('INPUT');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(field().placeholder).toBe('Elegir bodega');
    const label = fixture.nativeElement.querySelector(`label[for="${field().id}"]`);
    expect(label?.textContent?.trim()).toBe('Bodega');
    expect(fixture.nativeElement.querySelector('ewms-icon[name="chevron-down"]')).not.toBeNull();
  });

  it('a click opens every option on the value, and the mouse keeps the focus on the field', async () => {
    host.model.set({ bodega: 'BS' });
    // Un `settle` antes de abrir: el modelo llega al campo en un efecto, no en la misma vuelta.
    await settle();
    await openPanel();

    expect(rows()).toHaveLength(3);
    expect(field().getAttribute('aria-controls')).toBe(listbox()?.id);
    expect(field().getAttribute('aria-activedescendant')).toBe(row(2).id);
    expect(row(2).getAttribute('aria-selected')).toBe('true');
    expect(row(0).getAttribute('aria-selected')).toBe('false');
    expect(row(2).style.fontWeight).toBe('var(--text-control-selected-weight)');
    expect(row(2).querySelector('ewms-icon[name="check"]')).not.toBeNull();

    // El ratón no saca el foco del campo: mousedown se previene y el hover marca la activa.
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    row(1).dispatchEvent(mousedown);
    expect(mousedown.defaultPrevented).toBe(true);
    row(0).dispatchEvent(new MouseEvent('mouseenter'));
    await settle();
    expect(field().getAttribute('aria-activedescendant')).toBe(row(0).id);
    row(1).click();
    await settle();
    expect(document.activeElement).toBe(field());
    expect(host.form.bodega().value()).toBe('BN');
    expect(field().hasAttribute('aria-controls')).toBe(false);
    expect(field().hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('three options, keyboard only: arrow opens, arrow picks, Enter confirms', async () => {
    field().focus();
    await press('ArrowDown');
    expect(rows()).toHaveLength(3);
    await press('ArrowDown');
    await press('ArrowUp');
    // Frena en los extremos, y marca la fila activa como el ratón.
    expect(field().getAttribute('aria-activedescendant')).toBe(row(0).id);
    for (let i = 0; i < 5; i += 1) {
      await press('ArrowDown');
    }
    expect(field().getAttribute('aria-activedescendant')).toBe(row(2).id);
    expect(row(2).classList.contains('bg-ghost-hover')).toBe(true);
    expect(row(1).classList.contains('bg-ghost-hover')).toBe(false);
    await press('ArrowUp');
    await press('Enter');

    expect(listbox()).toBeNull();
    expect(host.form.bodega().value()).toBe('BN');
    expect(host.form.bodega().touched()).toBe(true);
    expect(field().value).toBe('Bodega norte');
    expect(document.activeElement).toBe(field());
  });

  it('filters as you type, with no wait', async () => {
    field().value = 'norte';
    field().dispatchEvent(new Event('input'));
    await settle();

    expect(rows()).toHaveLength(1);
    await press('ArrowDown');
    await press('Enter');
    expect(host.form.bodega().value()).toBe('BN');
  });

  it('closes on Escape, Tab or a click outside without changing the value', async () => {
    host.model.set({ bodega: 'BC' });
    for (const close of [
      () => press('Escape'),
      () => press('Tab'),
      async () => {
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await settle();
      },
    ]) {
      await openPanel();
      await press('ArrowDown');
      await close();
      expect(listbox()).toBeNull();
      expect(host.form.bodega().value()).toBe('BC');
    }
  });

  // La escala es la de field.types, que la spec del Input recorre en los tres tamaños.
  it('uses the Input scale, and a sm chevron even at size lg', async () => {
    host.size.set('lg');
    await settle();
    expect(field().classList.contains('h-12')).toBe(true);
    const icon = fixture.debugElement.query(By.css('ewms-icon[name="chevron-down"]'));
    expect((icon.componentInstance as { size: () => string }).size()).toBe('sm');
  });

  it('treats Open like Focus for the border, but an error keeps its colour', async () => {
    const resting = field().style.borderColor;
    await openPanel();
    expect(field().style.borderColor).not.toBe(resting);
    await press('Escape');

    host.error.set(true);
    host.hint.set('Elegí una bodega');
    await settle();
    const errorBorder = field().style.borderColor;
    expect(field().getAttribute('aria-invalid')).toBe('true');
    const hint = fixture.nativeElement.querySelector('p.mt-1') as HTMLElement;
    expect(hint.classList.contains('text-danger')).toBe(true);
    await openPanel();
    expect(field().style.borderColor).toBe(errorBorder);
    await press('Escape');

    // Quien deshabilita gana: el formulario apaga clic y teclado.
    host.locked.set(true);
    await settle();
    expect(field().disabled).toBe(true);
    field().click();
    await press('ArrowDown');
    expect(listbox()).toBeNull();
  });

  it('passes axe closed with a hint, and open', async () => {
    host.hint.set('Elegí una bodega');
    await settle();
    await expectNoAxeViolations(fixture.nativeElement);

    await openPanel();
    await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
  });

  it('hides the label from sight only: the combobox and the list keep their name', async () => {
    host.hideLabel.set(true);
    await settle();

    const label = fixture.nativeElement.querySelector(`label[for="${field().id}"]`) as HTMLElement;
    expect(label.textContent?.trim()).toBe('Bodega');
    expect(label.classList.contains('sr-only')).toBe(true);
    expect(label.classList.contains('block')).toBe(false);
    // `labels` es el cálculo del nombre por for/id que hace el navegador, y jsdom lo implementa.
    expect([...(field().labels ?? [])]).toEqual([label]);
    await expectNoAxeViolations(fixture.nativeElement);

    await openPanel();
    expect(listbox()?.getAttribute('aria-labelledby')).toBe(label.id);
    await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
  });
});

@Component({
  template: `
    <ewms-select
      [source]="source()"
      [display]="display"
      [formField]="articulo"
      label="Artículo"
      placeholder="Código o descripción"
      [hint]="hint()"
    />
  `,
  imports: [Select, FormField],
})
class SourceHost {
  readonly source = signal<SearchSource<Article>>(new ControlledSource());
  readonly display = {
    label: (item: Article) => `${item.code} — ${item.name}`,
    code: (item: Article) => item.code,
  };
  readonly model = signal<{ articulo: Article | null }>({ articulo: null });
  readonly form = form(this.model);
  readonly articulo = this.form.articulo;
  readonly hint = signal('');
}

describe('Select, a backend source (REQ-FE-DS3-001)', () => {
  let fixture: ComponentFixture<SourceHost>;
  let host: SourceHost;
  let settle: () => Promise<void>;
  let field: () => HTMLInputElement;
  let press: (name: string) => Promise<KeyboardEvent>;
  let source: ControlledSource;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty(DELAY_SEARCH_INPUT_TOKEN, '300ms');
    document.documentElement.style.setProperty(TIMEOUT_SEARCH_TOKEN, '5000ms');
    document.documentElement.style.setProperty(SCAN_THRESHOLD_TOKEN, '50ms');
    ({ fixture, host, settle, field, press } = await mount(SourceHost));
    source = host.source() as ControlledSource;
  });

  afterEach(() => {
    unmount(fixture);
    for (const token of [DELAY_SEARCH_INPUT_TOKEN, TIMEOUT_SEARCH_TOKEN, SCAN_THRESHOLD_TOKEN]) {
      document.documentElement.style.removeProperty(token);
    }
    vi.useRealTimers();
  });

  function region(): HTMLElement {
    return fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
  }

  function alert(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="alert"]');
  }

  /** Eventos reales, con una pausa entre teclas. */
  async function type(value: string, gap = 200): Promise<void> {
    for (const character of value) {
      vi.advanceTimersByTime(gap);
      field().value = field().value + character;
      field().dispatchEvent(new KeyboardEvent('keydown', { key: character, bubbles: true }));
      field().dispatchEvent(new Event('input'));
      await settle();
    }
  }

  async function waitForDelay(): Promise<void> {
    vi.advanceTimersByTime(300);
    await settle();
  }

  async function search(query = 'SKU', items = CATALOGUE, extra = {}): Promise<void> {
    await type(query);
    await waitForDelay();
    source.resolve(items, extra);
    await settle();
  }

  describe('RFE-01 — it filters while you type', () => {
    it('PACQ-01.1: three characters open the panel by themselves; a click alone does not', async () => {
      field().click();
      await settle();
      expect(listbox()).toBeNull();
      await search();
      expect(rows()).toHaveLength(3);
    });

    it('PACQ-01.3: five characters faster than the delay fire ONE query', async () => {
      await type('SKU-8', 20);
      await waitForDelay();
      expect(source.calls).toEqual([{ query: 'SKU-8', page: 0 }]);
    });

    it('PACQ-01.2: the newest query wins, and an older answer never paints over it', async () => {
      await type('SKU');
      await waitForDelay();
      await type('-8');
      await waitForDelay();
      expect(source.calls.length).toBe(2);

      source.resolve([CATALOGUE[0]!], {}, 1);
      await settle();
      expect(rows()).toHaveLength(0);

      source.resolve([CATALOGUE[1]!]);
      await settle();
      expect(rows()).toHaveLength(1);
      expect(rows()[0]?.textContent).toContain('SKU-88214');
    });
  });

  describe('RFE-02 to RFE-05 — the contract, failure and more results', () => {
    it('PACQ-02.1: total null with hasMore true offers more, reachable with the arrows', async () => {
      await search('SKU', [CATALOGUE[0]!], { total: null, hasMore: true });
      expect(rows()[1]?.textContent).toContain('Ver más resultados');

      await press('ArrowDown');
      await press('ArrowDown');
      expect(field().getAttribute('aria-activedescendant')).toContain('-option-1');
      await press('Enter');
      expect(source.calls.at(-1)).toEqual({ query: 'SKU', page: 1 });

      // PACQ-04.1: la página siguiente se AGREGA.
      source.resolve([CATALOGUE[1]!]);
      await settle();
      expect(rows().map((item) => item.textContent)).toEqual([
        expect.stringContaining('SKU-88213'),
        expect.stringContaining('SKU-88214'),
      ]);
    });

    it('PACQ-04.2: changing the text starts again at page 0', async () => {
      await search('SKU', [CATALOGUE[0]!], { hasMore: true });
      await type('9');
      await waitForDelay();
      expect(source.calls.at(-1)).toEqual({ query: 'SKU9', page: 0 });
      expect(rows()).toHaveLength(0);
    });

    it('PACQ-02.2: a source slower than the timeout is an ERROR, not an absence', async () => {
      host.source.set({ search: () => new Subject<SearchPage<Article>>() });
      await settle();
      await type('SKU');
      await waitForDelay();
      vi.advanceTimersByTime(5000);
      await settle();

      expect(alert()?.textContent).toContain('No se pudo consultar el catálogo');
      expect(fixture.nativeElement.textContent).not.toContain('Sin resultados');
    });

    it('PACQ-03.1: no results repeats the text searched, and keeps the value', async () => {
      await search('ZZZ', []);
      expect(listbox()?.textContent).toContain('Sin resultados para «ZZZ»');
      expect(host.form.articulo().value()).toBeNull();
    });

    it('PACQ-03.2/3: the error carries a retry in the flow, which repeats the query', async () => {
      host.hint.set('Escaneá o escribí el código');
      await type('SKU');
      await waitForDelay();
      source.fail();
      await settle();

      const retry = alert()?.querySelector('button') as HTMLButtonElement;
      expect(retry.textContent?.trim()).toBe('Reintentar');
      expect(fixture.nativeElement.contains(retry)).toBe(true);
      expect(field().value).toBe('SKU');
      expect(fixture.nativeElement.querySelector('p.mt-1')?.className).toContain('text-danger');

      retry.click();
      await settle();
      expect(source.calls.at(-1)).toEqual({ query: 'SKU', page: 0 });
      source.resolve(CATALOGUE);
      await settle();
      expect(rows()).toHaveLength(3);
      expect(alert()).toBeNull();
    });
  });

  describe('RFE-06 — a scanned code', () => {
    /** Una pistola: todas las teclas bajo el umbral, y Enter. */
    async function scan(code: string): Promise<void> {
      await type(code, 5);
      await press('Enter');
    }

    it('PACQ-05.1: one exact match is chosen WITHOUT the panel, and without waiting', async () => {
      await scan('SKU-90001');
      expect(source.calls).toEqual([{ query: 'SKU-90001', page: 0 }]);
      expect(listbox()).toBeNull();

      source.resolve([CATALOGUE[2]!]);
      await settle();
      expect(host.form.articulo().value()?.code).toBe('SKU-90001');

      // La consulta retrasada detrás de la ráfaga no reabre el panel.
      await waitForDelay();
      vi.advanceTimersByTime(1000);
      await settle();
      expect(listbox()).toBeNull();
      expect(source.calls.length).toBe(1);
    });

    it('PACQ-05.2: several matches, or one that is not exact, open the panel and choose nothing', async () => {
      await scan('SKU-9');
      source.resolve([CATALOGUE[2]!]);
      await settle();
      expect(host.form.articulo().value()).toBeNull();
      expect(rows()).toHaveLength(1);
    });

    it('neither a person at human speed nor the arrows on the list make a burst', async () => {
      await type('caja', 150);
      await press('Enter');
      expect(source.calls.length).toBe(0);
      await waitForDelay();
      source.resolve(CATALOGUE, { hasMore: true });
      await settle();
      for (const name of ['ArrowDown', 'ArrowDown', 'Escape', 'ArrowDown', 'ArrowDown', 'Enter']) {
        await press(name);
      }

      expect(host.form.articulo().value()).toEqual(CATALOGUE[0]);
      expect(source.calls.length).toBe(1);
    });

    it('with no token declared, nothing is a scan and nothing times out', async () => {
      document.documentElement.style.removeProperty(SCAN_THRESHOLD_TOKEN);
      document.documentElement.style.removeProperty(TIMEOUT_SEARCH_TOKEN);
      await scan('SKU-90001');
      expect(source.calls.length).toBe(0);

      host.source.set({ search: () => new Subject<SearchPage<Article>>() });
      await settle();
      await type('X');
      await waitForDelay();
      vi.advanceTimersByTime(60_000);
      await settle();
      expect(alert()).toBeNull();
    });
  });

  describe('RFE-07 and RFE-08 — the form and the keyboard', () => {
    it('PACQ-06.1: the value is the RECORD; clearing or half-typing never changes it', async () => {
      await search();
      rows()[1]?.click();
      await settle();
      expect(host.form.articulo().value()).toEqual(CATALOGUE[1]);
      expect(field().value).toBe('SKU-88214 — Caja plegable 80x60');

      // RFE-03: vaciar la caja no busca ni borra el valor.
      field().value = '';
      field().dispatchEvent(new Event('input'));
      await settle();
      expect(listbox()).toBeNull();

      // Al salir, el texto a medio escribir se reemplaza por la etiqueta del valor real.
      field().value = 'a medio escribir';
      field().dispatchEvent(new Event('input'));
      await settle();
      // Método del DOM y no un evento sintético: la compuerta 10 toma el nombre como clase.
      field().focus();
      field().blur();
      await settle();
      expect(field().value).toBe('SKU-88214 — Caja plegable 80x60');
      expect(host.form.articulo().value()).toEqual(CATALOGUE[1]);
      expect(host.form.articulo().touched()).toBe(true);
    });

    it('PACQ-06.2: Escape closes, leaves the value alone and keeps the focus', async () => {
      await search();
      field().focus();
      const event = await press('Escape');

      expect(listbox()).toBeNull();
      expect(host.form.articulo().value()).toBeNull();
      expect(document.activeElement).toBe(field());
      expect(event.defaultPrevented).toBe(true);
    });

    it('announces what happened in a live region, because the focus never moves', async () => {
      expect(region().getAttribute('aria-live')).toBe('polite');
      await type('SKU');
      await waitForDelay();
      expect(region().textContent?.trim()).toBe('Buscando…');

      source.resolve(CATALOGUE, { total: 340 });
      await settle();
      expect(region().textContent?.trim()).toBe('3 de 340');
    });

    it('PACQ-06.3: no axe violations, with the panel up', async () => {
      await search('SKU', CATALOGUE, { hasMore: true });
      expect(rows()).toHaveLength(4);

      // axe agenda su propio trabajo: el reloj real vuelve recién ahora.
      vi.useRealTimers();
      await expectNoAxeViolations(fixture.nativeElement);
      await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
    });
  });
});

@Component({
  template: `<ewms-select label="Artículo" [options]="options" [source]="source" />`,
  imports: [Select],
})
class BothHost {
  readonly options = WAREHOUSES;
  readonly source = new ControlledSource();
}

it('refuses options and source together, in dev mode', async () => {
  await TestBed.configureTestingModule({ imports: [BothHost] }).compileComponents();
  const fixture = TestBed.createComponent(BothHost);
  expect(() => fixture.detectChanges()).toThrow(/options or source, never both/);
});
