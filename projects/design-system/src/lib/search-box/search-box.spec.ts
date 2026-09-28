import { Component, signal, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { SearchBox } from './search-box';
import { EWMS_SEARCH_BOX_MESSAGES, normalizeQuery } from './search-box.types';

@Component({
  template: `
    <ewms-search-box
      label="Buscar en la aplicación"
      placeholder="Buscar…"
      shortcut="/"
      [disabled]="disabled()"
      [(value)]="value"
      (searchSubmit)="searched.push($event)"
    />
  `,
  imports: [SearchBox],
})
class TestHost {
  readonly box = viewChild.required(SearchBox);
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly searched: string[] = [];
}

const MESSAGES = { submit: 'Buscar', clear: 'Limpiar la búsqueda' };

describe('SearchBox', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [{ provide: EWMS_SEARCH_BOX_MESSAGES, useValue: MESSAGES }],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const field = (): HTMLInputElement => root().querySelector('input')!;
  const submitButton = (): HTMLButtonElement => root().querySelector('[data-search-submit]')!;
  const clearButton = (): HTMLButtonElement | null =>
    root().querySelector('[data-search-clear] button');
  const shortcut = (): HTMLElement | null => root().querySelector('[data-search-shortcut]');

  async function type(text: string): Promise<void> {
    field().value = text;
    field().dispatchEvent(new Event('input'));
    await settle();
  }

  it('names the field with its hidden label, and each button with the messages', async () => {
    const label = root().querySelector('label')!;
    expect(label.className).toContain('sr-only');
    expect(label.htmlFor).toBe(field().id);
    expect(label.textContent?.trim()).toBe('Buscar en la aplicación');
    expect(field().getAttribute('role')).toBe('searchbox');
    expect(submitButton().getAttribute('aria-label')).toBe('Buscar');

    await type('caja');
    expect(clearButton()?.getAttribute('aria-label')).toBe('Limpiar la búsqueda');
  });

  it('shows the shortcut while empty, announced once, and trades it for the clear button', async () => {
    expect(shortcut()?.textContent?.trim()).toBe('/');
    expect(shortcut()?.getAttribute('aria-hidden')).toBe('true');
    expect(field().getAttribute('aria-keyshortcuts')).toBe('/');
    expect(clearButton()).toBeNull();

    await type('caja');
    expect(shortcut()).toBeNull();
    expect(clearButton()).not.toBeNull();
  });

  it('searches on Enter and on the button, with the text tidied', async () => {
    await type('  caja   plegable ');
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    submitButton().click();
    await settle();
    expect(fixture.componentInstance.searched).toEqual(['caja plegable', 'caja plegable']);
  });

  it('keeps the button off, and out of the Tab order, until there is something to search', async () => {
    expect(submitButton().disabled).toBe(true);
    expect(submitButton().className).toContain('text-secondary');

    await type('   ');
    expect(submitButton().disabled).toBe(true);

    await type('caja');
    expect(submitButton().disabled).toBe(false);
    expect(submitButton().className).toContain('text-primary');
  });

  it('does not search for nothing', async () => {
    await type('   ');
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    submitButton().click();
    expect(fixture.componentInstance.searched).toEqual([]);
  });

  it('writes back what is typed, and clears to an empty field with the focus in it', async () => {
    await type('SKU-88');
    expect(fixture.componentInstance.value()).toBe('SKU-88');

    clearButton()!.click();
    await settle();
    expect(fixture.componentInstance.value()).toBe('');
    expect(field().value).toBe('');
    expect(document.activeElement).toBe(field());
  });

  it('takes the focus when asked, for the shortcut of the header', () => {
    fixture.componentInstance.box().focus();
    expect(document.activeElement).toBe(field());
  });

  it('disables the field and the button, and offers nothing to clear', async () => {
    await type('caja');
    fixture.componentInstance.disabled.set(true);
    await settle();
    expect(field().disabled).toBe(true);
    expect(submitButton().disabled).toBe(true);
    expect(clearButton()).toBeNull();
    expect(root().querySelector('[data-search-field]')?.className).toContain('border-default');
  });

  it('has no accessibility violations, empty or with text', async () => {
    await expectNoAxeViolations(root());
    await type('caja');
    await expectNoAxeViolations(root());
  });
});

describe('SearchBox messages', () => {
  @Component({
    template: `<ewms-search-box label="Buscar" [messages]="{ submit: 'Encontrar' }" />`,
    imports: [SearchBox],
  })
  class Overriding {}

  @Component({ template: `<ewms-search-box label="Buscar" />`, imports: [SearchBox] })
  class Unnamed {}

  it('lets one instance override a text of the token, and keeps the rest', async () => {
    TestBed.configureTestingModule({
      imports: [Overriding],
      providers: [{ provide: EWMS_SEARCH_BOX_MESSAGES, useValue: MESSAGES }],
    });
    const fixture = TestBed.createComponent(Overriding);
    fixture.detectChanges();
    const submit = (fixture.nativeElement as HTMLElement).querySelector('[data-search-submit]');
    expect(submit?.getAttribute('aria-label')).toBe('Encontrar');
  });

  it('refuses, in development, to draw buttons that have no name', () => {
    TestBed.configureTestingModule({ imports: [Unnamed] });
    const fixture = TestBed.createComponent(Unnamed);
    expect(() => fixture.detectChanges()).toThrow(/its buttons need names/);
  });
});

describe('normalizeQuery', () => {
  it('trims the ends and collapses repeated spaces', () => {
    expect(normalizeQuery('  caja \t  plegable  ')).toBe('caja plegable');
    expect(normalizeQuery('   ')).toBe('');
  });
});
