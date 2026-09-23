import { Component, LOCALE_ID, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import { expectNoAxeViolations } from '@ewms/testing';
import { DatePicker, type DatePickerValue } from './date-picker';
import { EWMS_DATE_PICKER_MESSAGES, type DatePickerMode } from './date-picker.types';

@Component({
  template: `
    <ewms-date-picker
      label="Fecha de entrega"
      hint="Día y mes, como se escriben acá"
      [mode]="mode()"
      [minDate]="min()"
      [maxDate]="max()"
      [formField]="entrega"
    />
  `,
  imports: [DatePicker, FormField],
})
class TestHost {
  readonly mode = signal<DatePickerMode>('single');
  readonly min = signal<string | null>(null);
  readonly max = signal<string | null>(null);
  readonly locked = signal(false);
  readonly model = signal<{ entrega: DatePickerValue }>({ entrega: '2026-03-16' });
  readonly form = form(this.model, (path) => {
    disabled(path.entrega, () => this.locked());
  });
  readonly entrega = this.form.entrega;
}

/** Con `viaLocaleId` el idioma llega por LOCALE_ID, el respaldo cuando el token no trae locale. */
async function setup(locale: string, viaLocaleId = false): Promise<ComponentFixture<TestHost>> {
  TestBed.resetTestingModule();
  const words = { chooseDate: 'Elegir fecha', previousMonth: 'Mes anterior', nextMonth: 'Mes siguiente' };
  await TestBed.configureTestingModule({
    imports: [TestHost],
    providers: [
      { provide: EWMS_DATE_PICKER_MESSAGES, useValue: viaLocaleId ? words : { ...words, locale } },
      ...(viaLocaleId ? [{ provide: LOCALE_ID, useValue: locale }] : []),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TestHost);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('DatePicker', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    fixture = await setup('es-CR');
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
    for (const container of document.querySelectorAll('.cdk-overlay-container')) {
      container.remove();
    }
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const host = () => fixture.componentInstance;
  const field = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const trigger = () =>
    fixture.nativeElement.querySelector('[data-date-trigger] button') as HTMLButtonElement;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const day = (iso: string) => document.querySelector<HTMLElement>(`[data-date="${iso}"]`)!;
  const value = () => host().form.entrega().value();
  /** `settle` incluido: el modelo llega al campo en un efecto, no en la misma vuelta. */
  const setValue = async (next: DatePickerValue) => {
    host().model.set({ entrega: next });
    await settle();
  };

  /** Saliendo del campo, o con Enter si `enter`: los dos caminos confirman lo escrito. */
  async function type(text: string, enter = false): Promise<void> {
    field().focus();
    field().value = text;
    field().dispatchEvent(new Event('input'));
    if (enter) {
      field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else {
      // Método del DOM y no un evento: la compuerta 10 toma el nombre del evento como clase.
      field().blur();
    }
    await settle();
  }

  async function press(key: string, init: KeyboardEventInit = {}): Promise<void> {
    (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    );
    await settle();
  }

  async function open(): Promise<void> {
    trigger().click();
    await settle();
  }

  it('shows and reads the date in the language of the app, as an ISO string', async () => {
    expect(field().value).toBe('16/3/2026');

    await type('2/4/26', true);
    expect(value()).toBe('2026-04-02');
    expect(field().value).toBe('2/4/2026');

    // El 31 de febrero no existe, «1/2» está a medias y «mañana» no es una fecha: vuelve lo que
    // había, sin tocar el valor.
    for (const text of ['31/2/2026', '1/2', 'mañana']) {
      await type(text);
      expect(value()).toBe('2026-04-02');
      expect(field().value).toBe('2/4/2026');
    }

    await type('');
    expect(value()).toBeNull();
  });

  it('in English reads month first, starts the week on Sunday and names the month in English', async () => {
    fixture.destroy();
    fixture = await setup('en-US', true);
    expect(field().value).toBe('3/16/2026');

    await type('4/2/2026');
    expect(value()).toBe('2026-04-02');

    await open();
    expect(dialog()?.querySelector('h2')?.textContent).toContain('April 2026');
    expect(dialog()?.querySelector('th')?.getAttribute('abbr')).toBe('Sunday');
  });

  it('APG: opens on the value with the focus in the grid, walks it with the keys and picks with Enter', async () => {
    await open();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(dialog()?.querySelector('h2')?.textContent).toContain('marzo de 2026');
    // El idioma empieza la semana el lunes.
    expect(dialog()?.querySelector('th')?.getAttribute('abbr')).toBe('lunes');
    expect(document.activeElement).toBe(day('2026-03-16'));
    expect(day('2026-03-16').getAttribute('aria-selected')).toBe('true');

    await press('ArrowRight');
    await press('ArrowDown');
    expect(document.activeElement).toBe(day('2026-03-24'));
    await press('Home');
    expect(document.activeElement).toBe(day('2026-03-23'));
    await press('End');
    expect(document.activeElement).toBe(day('2026-03-29'));
    await press('PageDown');
    expect(document.activeElement).toBe(day('2026-04-29'));
    await press('PageUp', { shiftKey: true });
    expect(document.activeElement).toBe(day('2025-04-29'));
    await press('PageDown', { shiftKey: true });
    await press('PageUp');
    expect(document.activeElement).toBe(day('2026-03-29'));
    await press('ArrowUp');
    await press('ArrowLeft');

    await press('Enter');
    expect(value()).toBe('2026-03-21');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('Escape closes without choosing; Tab stays inside the dialog', async () => {
    await open();
    await press('Tab');
    expect(document.activeElement?.closest('[data-date-previous]')).not.toBeNull();
    await press('Tab', { shiftKey: true });
    expect(document.activeElement).toBe(day('2026-03-16'));

    await press('Escape');
    expect(dialog()).toBeNull();
    expect(value()).toBe('2026-03-16');
    expect(document.activeElement).toBe(trigger());
  });

  it('min and max: Alt+Down opens on the nearest allowed day; the rest is seen, not chosen', async () => {
    host().min.set('2026-03-10');
    host().max.set('2026-04-05');
    await setValue(null);
    await settle();

    field().focus();
    await press('ArrowDown', { altKey: true });
    // Sin valor abre en hoy, llevado dentro de [min, max]: hoy ya pasó el máximo.
    expect(document.activeElement).toBe(day('2026-04-05'));

    document.querySelector<HTMLButtonElement>('[data-date-previous] button')!.click();
    await settle();
    expect(dialog()?.querySelector('h2')?.textContent).toContain('marzo');
    const early = day('2026-03-09');
    expect(early.getAttribute('aria-disabled')).toBe('true');
    early.click();
    await settle();
    expect(value()).toBeNull();

    document.querySelector<HTMLButtonElement>('[data-date-next] button')!.click();
    await settle();
    expect(dialog()?.querySelector('h2')?.textContent).toContain('abril');
  });

  it('range: two picks, in any order, make the table DateRange; typed too', async () => {
    host().mode.set('range');
    // Abre en el inicio del rango: sin valor abriría en el hoy real del reloj.
    await setValue({ from: '2026-03-16', to: '2026-03-16' });
    await settle();

    await open();
    await press('Enter');
    expect(dialog()).not.toBeNull();
    await press('ArrowLeft');
    await press('ArrowLeft');
    await press('Enter');

    expect(value()).toEqual({ from: '2026-03-14', to: '2026-03-16' });
    expect(field().value).toBe('14/3/2026 – 16/3/2026');

    await type('1/4/2026 - 3/4/2026');
    expect(value()).toEqual({ from: '2026-04-01', to: '2026-04-03' });
    await type('5/4/2026 - 2/4/2026');
    expect(value()).toEqual({ from: '2026-04-02', to: '2026-04-05' });
    await type('7/4/2026');
    expect(value()).toEqual({ from: '2026-04-07', to: '2026-04-07' });
    await type('');
    expect(value()).toBeNull();
  });

  it('passes axe closed, open on today, and disabled; the button toggles it', async () => {
    await expectNoAxeViolations(fixture.nativeElement);

    // Sin valor abre en el mes de hoy, con hoy marcado.
    await setValue(null);
    await open();
    expect(document.querySelector('[aria-current="date"]')).toBe(document.activeElement);
    await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
    await open();
    expect(dialog()).toBeNull();

    host().locked.set(true);
    await settle();
    expect(field().disabled).toBe(true);
    expect(trigger().disabled).toBe(true);
    await expectNoAxeViolations(fixture.nativeElement);
  });
});
