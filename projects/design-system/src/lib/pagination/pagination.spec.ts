import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { Pagination, type PaginationMessages } from './pagination';

const MESSAGES: PaginationMessages = {
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  pageOf: (page, pages) => `Página ${page} de ${pages}`,
  rowsTotal: (total) => `${total} filas`,
};

@Component({
  template: `
    <ewms-pagination
      [page]="page()"
      [pageCount]="pageCount()"
      [total]="total()"
      [messages]="messages"
      (pageChange)="asked = $event"
    />
  `,
  imports: [Pagination],
})
class TestHost {
  readonly messages = MESSAGES;
  readonly page = signal(0);
  readonly pageCount = signal(5);
  readonly total = signal<number | null>(97);

  asked: number | null = null;
}

describe('Pagination', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost, Pagination] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function button(which: 'previous' | 'next'): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[data-${which}-page] button`) as HTMLButtonElement;
  }

  it('counts pages FROM ONE for a person, while the input is zero-based', () => {
    // Base cero en el código, base uno para quien lee: se traduce una vez, acá.
    expect(fixture.nativeElement.querySelector('[data-page-label]')?.textContent?.trim()).toBe(
      'Página 1 de 5',
    );
  });

  it('shows how many rows matched, when the source counted them', () => {
    expect(fixture.nativeElement.textContent).toContain('97 filas');
  });

  it('says nothing about the total when the source did not count', async () => {
    host.total.set(null);
    await settle();
    expect(fixture.nativeElement.textContent).not.toContain('filas');
  });

  it('asks for the next page, zero-based', async () => {
    button('next').click();
    await settle();
    expect(host.asked).toBe(1);
  });

  it('asks for the previous page', async () => {
    host.page.set(2);
    await settle();
    button('previous').click();
    await settle();
    expect(host.asked).toBe(1);
  });

  it('disables the ends rather than clamping silently', async () => {
    // Un botón que parece pulsable y no hace nada enseña que el control no es confiable.
    expect(button('previous').disabled).toBe(true);
    expect(button('next').disabled).toBe(false);

    host.page.set(4);
    await settle();
    expect(button('previous').disabled).toBe(false);
    expect(button('next').disabled).toBe(true);
  });

  it('emits nothing from a disabled end, however it is reached', async () => {
    button('previous').click();
    await settle();
    expect(host.asked).toBeNull();
  });

  it('announces the page it moved to', () => {
    const label = fixture.nativeElement.querySelector('[data-page-label]') as HTMLElement;
    expect(label.getAttribute('role')).toBe('status');
    expect(label.getAttribute('aria-live')).toBe('polite');
  });

  it('is a navigation landmark with a name', () => {
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;
    expect(nav.getAttribute('aria-label')).toBe('Página 1 de 5');
  });

  it('has no axe violations, at either end', async () => {
    await expectNoAxeViolations(fixture.nativeElement);
    host.page.set(4);
    await settle();
    await expectNoAxeViolations(fixture.nativeElement);
  });
});
