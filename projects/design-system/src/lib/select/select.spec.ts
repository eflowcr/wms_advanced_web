import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
  SELECT_SEARCH_THRESHOLD,
  TIMEOUT_SEARCH_TOKEN,
  type SelectOption,
} from './select.types';

const WAREHOUSES: readonly SelectOption[] = [
  { label: 'Bodega central', value: 'BC' },
  { label: 'Bodega norte', value: 'BN' },
  { label: 'Bodega sur', value: 'BS' },
];

/** Una más que el umbral: la lista que ya busca. */
const LOCATIONS: readonly SelectOption[] = Array.from(
  { length: SELECT_SEARCH_THRESHOLD + 1 },
  (_unused, index) => ({ label: `Pasillo ${String.fromCharCode(65 + index)}`, value: index }),
);

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

function key(name: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
}

function listbox(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.cdk-overlay-container [role="listbox"]');
}

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')];
}

function row(index: number): HTMLElement {
  const found = rows()[index];
  if (!found) {
    throw new Error(`No option at index ${index}`);
  }
  return found;
}

function clearOverlays(): void {
  for (const container of document.querySelectorAll('.cdk-overlay-container')) {
    container.remove();
  }
}

@Component({
  template: `
    <ewms-select
      [options]="options()"
      [size]="size()"
      [label]="'Bodega'"
      [placeholder]="'Elegir bodega'"
      [hint]="hint()"
      [error]="error()"
      [formControl]="control"
    />
  `,
  imports: [Select, ReactiveFormsModule],
})
class ListHost {
  readonly options = signal<readonly SelectOption[]>(WAREHOUSES);
  readonly size = signal<FieldSize>('md');
  readonly hint = signal('');
  readonly error = signal(false);
  readonly control = new FormControl<unknown>(null);
}

describe('Select, a short list', () => {
  let fixture: ComponentFixture<ListHost>;
  let host: ListHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ListHost] }).compileComponents();
    fixture = TestBed.createComponent(ListHost);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    clearOverlays();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[role="combobox"]') as HTMLButtonElement;
  }

  async function press(name: string): Promise<KeyboardEvent> {
    const event = key(name);
    trigger().dispatchEvent(event);
    await settle();
    return event;
  }

  async function openPanel(): Promise<void> {
    trigger().focus();
    trigger().click();
    await settle();
  }

  it(`does not search with ${SELECT_SEARCH_THRESHOLD} options or fewer: a button, named by its label`, () => {
    expect(trigger().tagName).toBe('BUTTON');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    const labelId = trigger().getAttribute('aria-labelledby');
    expect(fixture.nativeElement.querySelector(`#${labelId}`)?.textContent?.trim()).toBe('Bodega');
    expect(trigger().textContent?.trim()).toContain('Elegir bodega');
  });

  it('opens on the current value and points aria-controls at the listbox while it exists', async () => {
    host.control.setValue('BS');
    await openPanel();

    expect(listbox()).not.toBeNull();
    expect(rows()).toHaveLength(3);
    expect(trigger().getAttribute('aria-controls')).toBe(listbox()?.id);
    expect(trigger().getAttribute('aria-activedescendant')).toBe(row(2).id);

    await press('Escape');
    expect(trigger().hasAttribute('aria-controls')).toBe(false);
    expect(trigger().hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('moves with the arrows, stops at the ends, and marks the active row like the mouse', async () => {
    trigger().focus();
    await press('ArrowDown');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(row(0).id);

    await press('ArrowUp');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(row(0).id);
    for (let i = 0; i < 10; i += 1) {
      await press('ArrowDown');
    }
    expect(trigger().getAttribute('aria-activedescendant')).toBe(row(2).id);
    expect(row(2).classList.contains('bg-ghost-hover')).toBe(true);
    expect(row(1).classList.contains('bg-ghost-hover')).toBe(false);
  });

  it('jumps to an option by typing its first letters (typeahead)', async () => {
    trigger().focus();
    for (const letter of 'bodega n') {
      await press(letter);
    }

    expect(listbox()).not.toBeNull();
    // A mitad de palabra el espacio es una letra más, no el clic del botón.
    expect(trigger().getAttribute('aria-activedescendant')).toBe(row(1).id);
  });

  it('chooses on Enter, reports to the form, marks it touched and keeps the focus', async () => {
    trigger().focus();
    await press('ArrowDown');
    await press('ArrowDown');
    await press('Enter');

    expect(listbox()).toBeNull();
    expect(host.control.value).toBe('BN');
    expect(host.control.touched).toBe(true);
    expect(trigger().textContent?.trim()).toContain('Bodega norte');
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on Escape, Tab or a click outside without changing the value', async () => {
    host.control.setValue('BC');
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
      expect(host.control.value).toBe('BC');
    }
  });

  it('keeps the focus on the trigger when an option is clicked', async () => {
    await openPanel();
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    row(1).dispatchEvent(mousedown);
    expect(mousedown.defaultPrevented).toBe(true);

    row(2).dispatchEvent(new MouseEvent('mouseenter'));
    await settle();
    expect(trigger().getAttribute('aria-activedescendant')).toBe(row(2).id);

    row(1).click();
    await settle();
    expect(document.activeElement).toBe(trigger());
    expect(host.control.value).toBe('BN');
  });

  it('marks the chosen row selected, bold and checked', async () => {
    host.control.setValue('BN');
    await openPanel();

    expect(row(1).getAttribute('aria-selected')).toBe('true');
    expect(row(0).getAttribute('aria-selected')).toBe('false');
    expect(row(1).style.fontWeight).toBe('var(--text-control-selected-weight)');
    expect(row(1).querySelector('ewms-icon[name="check"]')).not.toBeNull();
  });

  const boxes: readonly (readonly [FieldSize, string, string])[] = [
    ['sm', 'h-8', 'px-2.5'],
    ['md', 'h-10', 'px-3'],
    ['lg', 'h-12', 'px-3.5'],
  ];

  it.each(boxes)('uses the Input scale and a sm chevron at size "%s"', async (size, height, padding) => {
    host.size.set(size);
    await settle();

    expect(trigger().classList.contains(height)).toBe(true);
    expect(trigger().classList.contains(padding)).toBe(true);
    const icon = fixture.debugElement.query(By.css('ewms-icon[name="chevron-down"]'));
    expect((icon.componentInstance as { size: () => string }).size()).toBe('sm');
  });

  it('treats Open like Focus for the border, but an error keeps its colour', async () => {
    const resting = trigger().style.borderColor;
    await openPanel();
    expect(trigger().style.borderColor).not.toBe(resting);
    await press('Escape');

    host.error.set(true);
    host.hint.set('Elegí una bodega');
    await settle();
    const errorBorder = trigger().style.borderColor;
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.querySelector('p')?.classList.contains('text-danger')).toBe(true);
    await openPanel();
    expect(trigger().style.borderColor).toBe(errorBorder);
  });

  it('refuses click and keyboard when the form disables it', async () => {
    host.control.disable();
    await settle();

    expect(trigger().disabled).toBe(true);
    trigger().click();
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
});

@Component({
  template: `
    <ewms-select
      [options]="options()"
      [searchable]="searchable()"
      label="Ubicación"
      [formControl]="control"
    />
  `,
  imports: [Select, ReactiveFormsModule],
})
class LongListHost {
  readonly options = signal<readonly SelectOption[]>(LOCATIONS);
  readonly searchable = signal<'auto' | boolean>('auto');
  readonly control = new FormControl<unknown>(null);
}

describe('Select, a long list in memory', () => {
  let fixture: ComponentFixture<LongListHost>;
  let host: LongListHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LongListHost],
      providers: [{ provide: EWMS_SELECT_MESSAGES, useValue: MESSAGES }],
    }).compileComponents();
    fixture = TestBed.createComponent(LongListHost);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    clearOverlays();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function field(): HTMLInputElement {
    return fixture.nativeElement.querySelector('[role="combobox"]') as HTMLInputElement;
  }

  it(`searches with more than ${SELECT_SEARCH_THRESHOLD}: a text field, opened with every option`, async () => {
    expect(field().tagName).toBe('INPUT');
    field().click();
    await settle();

    expect(rows()).toHaveLength(LOCATIONS.length);
  });

  it('filters locally as you type, with no wait, and chooses the value', async () => {
    field().value = 'pasillo c';
    field().dispatchEvent(new Event('input'));
    await settle();

    expect(rows()).toHaveLength(1);
    field().dispatchEvent(key('ArrowDown'));
    field().dispatchEvent(key('Enter'));
    await settle();

    expect(host.control.value).toBe(2);
    expect(field().value).toBe('Pasillo C');
  });

  it('opens on the chosen value when it comes back, with the arrows', async () => {
    host.control.setValue(5);
    await settle();
    expect(field().value).toBe('Pasillo F');

    field().dispatchEvent(key('ArrowDown'));
    await settle();
    expect(field().getAttribute('aria-activedescendant')).toBe(row(5).id);
    expect(row(5).getAttribute('aria-selected')).toBe('true');
  });

  it('obeys searchable over the count, in both directions', async () => {
    host.searchable.set(false);
    await settle();
    expect(field().tagName).toBe('BUTTON');

    host.options.set(LOCATIONS.slice(0, 3));
    host.searchable.set(true);
    await settle();
    expect(field().tagName).toBe('INPUT');
  });
});

@Component({
  template: `
    <ewms-select
      [source]="source()"
      [display]="display"
      [formControl]="control"
      label="Artículo"
      placeholder="Código o descripción"
      [hint]="hint()"
    />
  `,
  imports: [Select, ReactiveFormsModule],
})
class SourceHost {
  readonly source = signal<SearchSource<Article>>(new ControlledSource());
  readonly display = {
    label: (item: Article) => `${item.code} — ${item.name}`,
    code: (item: Article) => item.code,
  };
  readonly control = new FormControl<Article | null>(null);
  readonly hint = signal('');
}

describe('Select, a backend source (REQ-FE-DS3-001)', () => {
  let fixture: ComponentFixture<SourceHost>;
  let host: SourceHost;
  let source: ControlledSource;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty(DELAY_SEARCH_INPUT_TOKEN, '300ms');
    document.documentElement.style.setProperty(TIMEOUT_SEARCH_TOKEN, '5000ms');
    document.documentElement.style.setProperty(SCAN_THRESHOLD_TOKEN, '50ms');

    await TestBed.configureTestingModule({
      imports: [SourceHost],
      // Los textos se proveen, no se pasan por entrada: así se usa el componente.
      providers: [{ provide: EWMS_SELECT_MESSAGES, useValue: MESSAGES }],
    }).compileComponents();
    fixture = TestBed.createComponent(SourceHost);
    host = fixture.componentInstance;
    source = host.source() as ControlledSource;
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    clearOverlays();
    for (const token of [DELAY_SEARCH_INPUT_TOKEN, TIMEOUT_SEARCH_TOKEN, SCAN_THRESHOLD_TOKEN]) {
      document.documentElement.style.removeProperty(token);
    }
    vi.useRealTimers();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function field(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input') as HTMLInputElement;
  }

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

  async function press(name: string): Promise<KeyboardEvent> {
    const event = key(name);
    field().dispatchEvent(event);
    await settle();
    return event;
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
    it('PACQ-01.1: three characters open the panel by themselves, with no chevron', async () => {
      expect(listbox()).toBeNull();
      expect(fixture.nativeElement.querySelector('ewms-icon[name="chevron-down"]')).toBeNull();
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

    it('clearing the box stops searching and does not touch the chosen value', async () => {
      await search();
      rows()[0]?.click();
      await settle();

      field().value = '';
      field().dispatchEvent(new Event('input'));
      await settle();

      expect(listbox()).toBeNull();
      expect(host.control.value?.code).toBe('SKU-88213');
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

    it('with no timeout token declared it simply never times out', async () => {
      document.documentElement.style.removeProperty(TIMEOUT_SEARCH_TOKEN);
      host.source.set({ search: () => new Subject<SearchPage<Article>>() });
      await settle();
      await type('SKU');
      await waitForDelay();
      vi.advanceTimersByTime(60_000);
      await settle();
      expect(alert()).toBeNull();
    });

    it('PACQ-03.1: no results repeats the text searched, and keeps the value', async () => {
      await search('ZZZ', []);
      expect(listbox()?.textContent).toContain('Sin resultados para «ZZZ»');
      expect(host.control.value).toBeNull();
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
      expect(host.control.value?.code).toBe('SKU-90001');

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
      expect(host.control.value).toBeNull();
      expect(rows()).toHaveLength(1);
    });

    it('a person typing at human speed is never mistaken for a gun', async () => {
      await type('SKU-90001', 150);
      await press('Enter');
      expect(source.calls.length).toBe(0);
      await waitForDelay();
      expect(source.calls.length).toBe(1);
    });

    it('walking the list with the arrows does not build a burst', async () => {
      await search('caja', CATALOGUE, { hasMore: true });
      await press('ArrowDown');
      await press('ArrowDown');
      await press('Escape');
      await press('ArrowDown');
      await press('ArrowDown');
      await press('Enter');

      expect(host.control.value).toEqual(CATALOGUE[0]);
      expect(source.calls.length).toBe(1);
    });

    it('with no threshold token declared, nothing is ever classified as a scan', async () => {
      document.documentElement.style.removeProperty(SCAN_THRESHOLD_TOKEN);
      await scan('SKU-90001');
      expect(source.calls.length).toBe(0);
    });
  });

  describe('RFE-07 and RFE-08 — the form and the keyboard', () => {
    it('PACQ-06.1: the value is the RECORD, not the text', async () => {
      await search();
      rows()[1]?.click();
      await settle();

      expect(host.control.value).toEqual(CATALOGUE[1]);
      expect(field().value).toBe('SKU-88214 — Caja plegable 80x60');
    });

    it('PACQ-06.2: Escape closes, leaves the value alone and keeps the focus', async () => {
      await search();
      field().focus();
      const event = await press('Escape');

      expect(listbox()).toBeNull();
      expect(host.control.value).toBeNull();
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

    it('is a combobox that says whether its list is open, and what is active', async () => {
      expect(field().getAttribute('aria-expanded')).toBe('false');
      expect(field().getAttribute('aria-controls')).toBeNull();
      await search();
      expect(field().getAttribute('aria-expanded')).toBe('true');
      expect(field().getAttribute('aria-controls')).toBeTruthy();
      await press('ArrowDown');
      expect(field().getAttribute('aria-activedescendant')).toContain('-option-0');
    });

    it('leaving the field puts the chosen record back in the box', async () => {
      await search();
      rows()[0]?.click();
      await settle();

      field().value = 'a medio escribir';
      field().dispatchEvent(new Event('input'));
      await settle();
      // Método del DOM y no un evento sintético: la compuerta 10 toma el nombre como clase.
      field().focus();
      field().blur();
      await settle();

      expect(field().value).toBe('SKU-88213 — Caja plegable 60x40');
      expect(host.control.touched).toBe(true);
    });

    it('quien deshabilita gana: the form can disable it', async () => {
      host.control.disable();
      await settle();
      expect(field().disabled).toBe(true);
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
