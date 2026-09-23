import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { EWMS_DATE_PICKER_MESSAGES } from '../date-picker/date-picker.types';
import { EWMS_SELECT_MESSAGES } from '../select/select.types';
import { EWMS_FILTER_CHIPS_MESSAGES, type FilterChipsMessages } from './filter-chips';
import {
  EWMS_FILTER_BAR_MESSAGES,
  FilterBar,
  type FilterBarMessages,
  type FilterField,
  type FilterValues,
} from './filter-bar';

const MESSAGES: FilterBarMessages = {
  moreFilters: (active) => (active === 0 ? 'Más filtros' : `Más filtros (${active})`),
  fewerFilters: 'Menos filtros',
};

const CHIP_MESSAGES: FilterChipsMessages = {
  clearFilters: 'Limpiar filtros',
  removeFilter: (field) => `Quitar el filtro ${field}`,
};

const FIELDS: readonly FilterField[] = [
  {
    kind: 'select',
    key: 'almacen',
    label: 'Almacén',
    options: [
      { label: 'Central', value: 'central' },
      { label: 'Norte', value: 'norte' },
    ],
  },
  { kind: 'date-range', key: 'fecha', label: 'Período' },
  { kind: 'search', key: 'texto', label: 'Buscar' },
  { kind: 'select', key: 'cliente', label: 'Cliente', options: [{ label: 'Andes', value: 'andes' }] },
];

@Component({
  template: `
    <ewms-filter-bar [fields]="fields" [value]="value()" (valueChange)="value.set($event)" />
  `,
  imports: [FilterBar],
})
class TestHost {
  readonly fields = FIELDS;
  readonly value = signal<FilterValues>({});
}

describe('FilterBar', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const fields = (): string[] =>
    [...root().querySelectorAll('[data-field]')].map((el) => el.getAttribute('data-field') ?? '');
  const chips = (): string[] =>
    [...root().querySelectorAll('[data-chip]')].map((chip) =>
      (chip.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        { provide: EWMS_FILTER_BAR_MESSAGES, useValue: MESSAGES },
        { provide: EWMS_FILTER_CHIPS_MESSAGES, useValue: CHIP_MESSAGES },
        { provide: EWMS_SELECT_MESSAGES, useValue: { noResults: () => '', results: () => '' } },
        {
          provide: EWMS_DATE_PICKER_MESSAGES,
          useValue: {
            chooseDate: 'Elegir fecha',
            previousMonth: 'Mes anterior',
            nextMonth: 'Mes siguiente',
            locale: 'es-CR',
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    await settle();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('SHOWS THREE FIELDS and keeps the rest behind «Más filtros», which counts the active ones', async () => {
    expect(fields()).toEqual(['almacen', 'fecha', 'texto']);
    const more = root().querySelector('[data-more-filters] button') as HTMLButtonElement;
    expect(more.textContent?.trim()).toBe('Más filtros');

    host.value.set({ cliente: 'andes' });
    await settle();
    expect(more.textContent?.trim()).toBe('Más filtros (1)');

    more.click();
    await settle();
    expect(fields()).toEqual(['almacen', 'fecha', 'texto', 'cliente']);
    expect(root().querySelector('[data-more-filters] button')?.textContent?.trim()).toBe(
      'Menos filtros',
    );
  });

  it('applies on change, and the value rules the fields', async () => {
    const box = root().querySelector('[data-field="texto"] input') as HTMLInputElement;
    box.value = 'EXP-0002';
    box.dispatchEvent(new Event('input'));
    await settle();
    expect(host.value()).toEqual({ texto: 'EXP-0002' });

    // El valor llega de afuera (la URL, un enlace compartido) y el campo lo sigue.
    host.value.set({ texto: 'otro' });
    await settle();
    expect((root().querySelector('[data-field="texto"] input') as HTMLInputElement).value).toBe(
      'otro',
    );
  });

  it('writes a chip per filter: the option label, the period in the language of the app', async () => {
    host.value.set({ almacen: 'central', fecha: { from: '2026-03-01', to: '2026-03-31' } });
    await settle();
    expect(chips()).toEqual(['Almacén: Central', 'Período: 01/03/2026 – 31/03/2026']);

    // Un solo extremo, y una opción que ya no está en la lista: el valor crudo.
    host.value.set({ fecha: { from: '2026-03-01' }, almacen: 'sur' });
    await settle();
    expect(chips()).toEqual(['Almacén: sur', 'Período: 01/03/2026']);
    host.value.set({ fecha: { to: '2026-03-31' }, texto: 'EXP' });
    await settle();
    expect(chips()).toEqual(['Período: 31/03/2026', 'Buscar: EXP']);
    host.value.set({ almacen: 'central', fecha: { from: '2026-03-01', to: '2026-03-31' } });
    await settle();

    // El × de un chip quita ese filtro; «Limpiar filtros», todos.
    (root().querySelector('[data-chip="almacen"] button') as HTMLButtonElement).click();
    await settle();
    expect(host.value()).toEqual({ fecha: { from: '2026-03-01', to: '2026-03-31' } });
    (root().querySelector('[data-clear-filters]') as HTMLButtonElement).click();
    await settle();
    expect(host.value()).toEqual({});
    expect(chips()).toEqual([]);
  });

  it('has no axe violations with a filter on', async () => {
    host.value.set({ almacen: 'central' });
    await settle();
    await expectNoAxeViolations(root());
  });
});
