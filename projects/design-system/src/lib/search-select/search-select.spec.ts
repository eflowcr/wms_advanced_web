import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { expectNoAxeViolations } from '@ewms/testing';
import { Subject, timer, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SearchSelect, type SearchSelectMessages } from './search-select';
import {
  DELAY_SEARCH_INPUT_TOKEN,
  EWMS_SEARCH_SELECT_MESSAGES,
  SCAN_THRESHOLD_TOKEN,
  TIMEOUT_SEARCH_TOKEN,
} from './search-select.types';
import type { SearchPage, SearchSource } from './search-source';

interface Article {
  readonly code: string;
  readonly name: string;
}

const CATALOGUE: readonly Article[] = [
  { code: 'SKU-88213', name: 'Caja plegable 60x40' },
  { code: 'SKU-88214', name: 'Caja plegable 80x60' },
  { code: 'SKU-90001', name: 'Film estirable 23 micras' },
];

const MESSAGES: SearchSelectMessages = {
  searching: 'Buscando…',
  noResults: (query) => `Sin resultados para «${query}»`,
  error: 'No se pudo consultar el catálogo',
  retry: 'Reintentar',
  more: 'Ver más resultados',
  results: (count, total) => (total === null ? `${count} resultados` : `${count} de ${total}`),
};

/**
 * Nada resuelve hasta que la prueba lo dice. Un subject por llamada: así se puede responder
 * una consulta vieja después de una nueva (PACQ-01.2); uno compartido no probaría nada.
 */
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
    subject?.next({
      items,
      page: 0,
      pageSize: 20,
      total: items.length,
      hasMore: false,
      ...extra,
    });
    subject?.complete();
  }

  fail(): void {
    this.pending.at(-1)?.error(new Error('boom'));
  }
}

/** Nunca responde: para el timeout. */
class SilentSource implements SearchSource<Article> {
  search(): Observable<SearchPage<Article>> {
    return new Subject<SearchPage<Article>>();
  }
}

class SlowSource implements SearchSource<Article> {
  constructor(private readonly delay: number) {}

  search(): Observable<SearchPage<Article>> {
    return timer(this.delay).pipe(
      map(() => ({
        items: CATALOGUE,
        page: 0,
        pageSize: 20,
        total: 3,
        hasMore: false,
      })),
    );
  }
}

@Component({
  template: `
    <ewms-search-select
      [source]="source()"
      [display]="display"
      [formControl]="control"
      label="Artículo"
      placeholder="Código o descripción"
      [hint]="hint()"
    />
  `,
  imports: [SearchSelect, ReactiveFormsModule],
})
class TestHost {
  readonly source = signal<SearchSource<Article>>(new ControlledSource());
  readonly display = {
    label: (item: Article) => `${item.code} — ${item.name}`,
    code: (item: Article) => item.code,
  };
  readonly control = new FormControl<Article | null>(null);
  readonly hint = signal('');
}

describe('SearchSelect', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let source: ControlledSource;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.documentElement.style.setProperty(DELAY_SEARCH_INPUT_TOKEN, '300ms');
    document.documentElement.style.setProperty(TIMEOUT_SEARCH_TOKEN, '5000ms');
    document.documentElement.style.setProperty(SCAN_THRESHOLD_TOKEN, '50ms');

    await TestBed.configureTestingModule({
      imports: [TestHost, SearchSelect, ReactiveFormsModule],
      // Los textos se proveen, no se pasan por entrada: así se usa el componente.
      providers: [{ provide: EWMS_SEARCH_SELECT_MESSAGES, useValue: MESSAGES }],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    source = host.source() as ControlledSource;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.nativeElement.remove();
    for (const container of document.querySelectorAll('.cdk-overlay-container')) {
      container.remove();
    }
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

  function panel(): HTMLElement | null {
    return document.querySelector('[role="listbox"]');
  }

  function rows(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')];
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

  async function press(key: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    field().dispatchEvent(event);
    await settle();
    return event;
  }

  async function waitForDelay(): Promise<void> {
    vi.advanceTimersByTime(300);
    await settle();
  }

  describe('RFE-01 — it filters while you type, with nothing opened first', () => {
    it('PACQ-01.1: three characters open the panel by themselves', async () => {
      expect(panel()).toBeNull();

      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE);
      await settle();

      expect(panel()).not.toBeNull();
      expect(rows().length).toBe(3);
    });

    it('PACQ-01.3: five characters faster than the delay fire ONE query', async () => {
      await type('SKU-8', 20);
      await waitForDelay();
      source.resolve(CATALOGUE);
      await settle();

      expect(source.calls.length).toBe(1);
      expect(source.calls[0]?.query).toBe('SKU-8');
    });

    it('PACQ-01.2: the newest query wins, and an older answer never paints over it', async () => {
      await type('SKU');
      await waitForDelay();

      await type('-8');
      await waitForDelay();
      expect(source.calls.length).toBe(2);

      // Responde la primera: switchMap ya la desuscribió y no llega a pantalla.
      source.resolve([CATALOGUE[0]!], {}, 1);
      await settle();
      expect(rows().length).toBe(0);

      source.resolve([CATALOGUE[1]!]);
      await settle();
      expect(rows().length).toBe(1);
      expect(rows()[0]?.textContent).toContain('SKU-88214');
    });

    it('clearing the box stops searching and does not touch the chosen value', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE);
      await settle();
      rows()[0]?.click();
      await settle();
      expect(host.control.value?.code).toBe('SKU-88213');

      field().value = '';
      field().dispatchEvent(new Event('input'));
      await settle();

      expect(panel()).toBeNull();
      expect(host.control.value?.code).toBe('SKU-88213');
    });
  });

  describe('RFE-02 — the data contract', () => {
    it('PACQ-02.1: total null with hasMore true works, and offers more', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE, { total: null, hasMore: true });
      await settle();

      expect(rows().length).toBe(4);
      expect(rows()[3]?.textContent).toContain('Ver más resultados');
    });

    it('PACQ-02.2: a source slower than the timeout is an ERROR, not an absence', async () => {
      host.source.set(new SilentSource());
      await settle();

      await type('SKU');
      await waitForDelay();
      vi.advanceTimersByTime(5000);
      await settle();

      const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(alert).not.toBeNull();
      expect(alert.textContent).toContain('No se pudo consultar el catálogo');
      expect(fixture.nativeElement.textContent).not.toContain('Sin resultados');
    });

    it('a source that answers inside the timeout is not an error', async () => {
      host.source.set(new SlowSource(1000));
      await settle();

      await type('SKU');
      await waitForDelay();
      vi.advanceTimersByTime(1000);
      await settle();

      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
      expect(rows().length).toBe(3);
    });

    it('with no timeout token declared it simply never times out', async () => {
      document.documentElement.style.removeProperty(TIMEOUT_SEARCH_TOKEN);
      host.source.set(new SilentSource());
      await settle();

      await type('SKU');
      await waitForDelay();
      vi.advanceTimersByTime(60_000);
      await settle();

      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('RFE-03 and RFE-04 — nothing found, and the service failing', () => {
    it('PACQ-03.1: no results repeats the text searched, and keeps the value', async () => {
      await type('ZZZ');
      await waitForDelay();
      source.resolve([]);
      await settle();

      expect(panel()?.textContent).toContain('Sin resultados para «ZZZ»');
      expect(host.control.value).toBeNull();
    });

    it('PACQ-03.2: the error carries a retry, in the flow, reachable with Tab', async () => {
      await type('SKU');
      await waitForDelay();
      source.fail();
      await settle();

      const retry = fixture.nativeElement.querySelector(
        '[role="alert"] button',
      ) as HTMLButtonElement;
      expect(retry).not.toBeNull();
      expect(retry.textContent?.trim()).toBe('Reintentar');

      // En el flujo, no en el overlay, que un Tab desde el campo saltaría.
      expect(fixture.nativeElement.contains(retry)).toBe(true);
      expect(retry.tabIndex).toBe(0);
    });

    it('PACQ-03.3: the retry repeats the same query, and the results show', async () => {
      await type('SKU');
      await waitForDelay();
      source.fail();
      await settle();

      const before = source.calls.length;
      (fixture.nativeElement.querySelector('[role="alert"] button') as HTMLButtonElement).click();
      await settle();

      expect(source.calls.length).toBe(before + 1);
      expect(source.calls.at(-1)).toEqual({ query: 'SKU', page: 0 });

      source.resolve(CATALOGUE);
      await settle();
      expect(rows().length).toBe(3);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    });

    it('the error leaves the text alone', async () => {
      await type('SKU');
      await waitForDelay();
      source.fail();
      await settle();
      expect(field().value).toBe('SKU');
    });
  });

  describe('RFE-05 — more results', () => {
    it('PACQ-04.1: the next page is APPENDED, not a replacement', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve([CATALOGUE[0]!], { hasMore: true });
      await settle();
      expect(rows().length).toBe(2);

      rows()[1]?.click();
      await settle();
      expect(source.calls.at(-1)).toEqual({ query: 'SKU', page: 1 });

      source.resolve([CATALOGUE[1]!], { hasMore: false });
      await settle();

      const labels = rows().map((row) => row.textContent);
      expect(labels.length).toBe(2);
      expect(labels[0]).toContain('SKU-88213');
      expect(labels[1]).toContain('SKU-88214');
    });

    it('PACQ-04.2: changing the text starts again at page 0', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve([CATALOGUE[0]!], { hasMore: true });
      await settle();
      rows()[1]?.click();
      await settle();
      source.resolve([CATALOGUE[1]!], { hasMore: true });
      await settle();
      expect(rows().length).toBe(3);

      await type('9');
      await waitForDelay();

      expect(source.calls.at(-1)).toEqual({ query: 'SKU9', page: 0 });
      expect(rows().length).toBe(0);
    });

    it('the more row is reachable with the arrows, and Enter activates it', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve([CATALOGUE[0]!], { hasMore: true });
      await settle();

      await press('ArrowDown');
      await press('ArrowDown');
      expect(field().getAttribute('aria-activedescendant')).toContain('-option-1');

      await press('Enter');
      expect(source.calls.at(-1)?.page).toBe(1);
    });
  });

  describe('RFE-06 — a scanned code', () => {
    /** Una pistola: todas las teclas bajo el umbral, y Enter. */
    async function scan(code: string): Promise<void> {
      await type(code, 5);
      await press('Enter');
    }

    it('PACQ-05.1: one exact match is chosen WITHOUT the panel ever opening', async () => {
      await scan('SKU-90001');

      expect(panel()).toBeNull();
      source.resolve([CATALOGUE[2]!]);
      await settle();

      expect(host.control.value?.code).toBe('SKU-90001');
      expect(panel()).toBeNull();
    });

    it('searches immediately, without waiting out the input delay', async () => {
      await scan('SKU-90001');
      expect(source.calls.length).toBe(1);
      expect(source.calls[0]).toEqual({ query: 'SKU-90001', page: 0 });
    });

    it('PACQ-05.2: three matches open the panel and choose nothing', async () => {
      await scan('SKU-882');
      source.resolve(CATALOGUE);
      await settle();

      expect(rows().length).toBe(3);
      expect(host.control.value).toBeNull();
    });

    it('a single match that is not exact opens the panel instead of choosing', async () => {
      await scan('SKU-9');
      source.resolve([CATALOGUE[2]!]);
      await settle();

      expect(host.control.value).toBeNull();
      expect(rows().length).toBe(1);
    });

    it('a person typing at human speed is never mistaken for a gun', async () => {
      await type('SKU-90001', 150);
      await press('Enter');

      // No buscó al instante: espera el retardo como cualquier tipeo.
      expect(source.calls.length).toBe(0);
      await waitForDelay();
      expect(source.calls.length).toBe(1);
    });

    it('the delayed query behind the burst does not reopen the panel afterwards', async () => {
      await scan('SKU-90001');
      source.resolve([CATALOGUE[2]!]);
      await settle();

      await waitForDelay();
      vi.advanceTimersByTime(1000);
      await settle();

      expect(panel()).toBeNull();
      expect(source.calls.length).toBe(1);
    });

    it('walking the list with the arrows does not build a burst', async () => {
      await type('caja');
      await waitForDelay();
      source.resolve(CATALOGUE, { hasMore: true });
      await settle();

      // Cuatro teclas de navegación sin pausa, como mantener la flecha abajo.
      await press('ArrowDown');
      await press('ArrowDown');
      await press('Escape');
      await press('ArrowDown');
      await press('ArrowDown');
      await press('Enter');

      // Eligió la fila activa; no disparó una búsqueda de escaneo.
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
      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE);
      await settle();

      rows()[1]?.click();
      await settle();

      expect(host.control.value).toEqual(CATALOGUE[1]);
      expect(typeof host.control.value).toBe('object');
      expect(field().value).toBe('SKU-88214 — Caja plegable 80x60');
    });

    it('PACQ-06.2: Escape closes, leaves the value alone and keeps the focus', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE);
      await settle();
      field().focus();

      const event = await press('Escape');

      expect(panel()).toBeNull();
      expect(host.control.value).toBeNull();
      expect(document.activeElement).toBe(field());
      expect(event.defaultPrevented).toBe(true);
    });

    it('announces what happened in a live region, because the focus never moves', async () => {
      const region = () => fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
      expect(region().getAttribute('aria-live')).toBe('polite');

      await type('SKU');
      await waitForDelay();
      expect(region().textContent?.trim()).toBe('Buscando…');

      source.resolve(CATALOGUE, { total: null });
      await settle();
      expect(region().textContent?.trim()).toBe('3 resultados');

      await type('Z');
      await waitForDelay();
      source.resolve([]);
      await settle();
      expect(region().textContent).toContain('Sin resultados para');
    });

    it('the total reaches the announcement when the source reports one', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE, { total: 340 });
      await settle();

      const region = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
      expect(region.textContent?.trim()).toBe('3 de 340');
    });

    it('is a combobox that says whether its list is open, and what is active', async () => {
      expect(field().getAttribute('role')).toBe('combobox');
      expect(field().getAttribute('aria-expanded')).toBe('false');
      expect(field().getAttribute('aria-controls')).toBeNull();

      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE);
      await settle();

      expect(field().getAttribute('aria-expanded')).toBe('true');
      expect(field().getAttribute('aria-controls')).toBeTruthy();

      await press('ArrowDown');
      expect(field().getAttribute('aria-activedescendant')).toContain('-option-0');
    });

    it('quien deshabilita gana: the form can disable it', async () => {
      host.control.disable();
      await settle();
      expect(field().disabled).toBe(true);
    });

    it('leaving the field puts the chosen record back in the box', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE);
      await settle();
      rows()[0]?.click();
      await settle();

      field().value = 'a medio escribir';
      field().dispatchEvent(new Event('input'));
      await settle();

      // Método del DOM y no un evento sintético: la compuerta 10 toma toda cadena
      // como clase, y el nombre de ese evento es una utilidad de Tailwind.
      field().focus();
      field().blur();
      await settle();

      expect(field().value).toBe('SKU-88213 — Caja plegable 60x40');
      expect(host.control.touched).toBe(true);
    });

    it('shows a hint, and turns it danger-coloured in error', async () => {
      host.hint.set('Escaneá o escribí el código');
      await settle();
      const hint = fixture.nativeElement.querySelector('p.mt-1') as HTMLElement;
      expect(hint.textContent).toContain('Escaneá o escribí el código');
      expect(hint.className).toContain('text-secondary');

      await type('SKU');
      await waitForDelay();
      source.fail();
      await settle();

      expect((fixture.nativeElement.querySelector('p.mt-1') as HTMLElement).className).toContain(
        'text-danger',
      );
    });

    it('PACQ-06.3: no axe violations, with the panel up', async () => {
      await type('SKU');
      await waitForDelay();
      source.resolve(CATALOGUE, { hasMore: true });
      await settle();
      expect(rows().length).toBe(4);

      // axe agenda su propio trabajo: el reloj real vuelve recién ahora.
      vi.useRealTimers();

      // Campo y panel por separado: el panel vive en el overlay, fuera del fixture. Sobre
      // <body> correrían las reglas de landmarks, que son de página y valida e2e/showroom.e2e.ts.
      await expectNoAxeViolations(fixture.nativeElement);
      await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
    });
  });
});
