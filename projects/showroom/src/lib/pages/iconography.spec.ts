import { TestBed } from '@angular/core/testing';
import { ICON_CATEGORIES } from '@ewms/design-system';
import { expectNoAxeViolations } from '@ewms/testing';
import { ShowroomIconography } from './iconography';

describe('ShowroomIconography', () => {
  async function render() {
    await TestBed.configureTestingModule({ imports: [ShowroomIconography] }).compileComponents();
    const fixture = TestBed.createComponent(ShowroomIconography);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('lists every icon once, grouped by domain and interface', async () => {
    const { element } = await render();

    const names = [...element.querySelectorAll('[data-icon-name]')].map((button) =>
      button.getAttribute('data-icon-name'),
    );
    expect(names).toEqual([...ICON_CATEGORIES.domain, ...ICON_CATEGORIES.interface]);
    expect(element.textContent).toContain(`Dominio (${ICON_CATEGORIES.domain.length})`);
    expect(element.textContent).toContain(`Interfaz (${ICON_CATEGORIES.interface.length})`);
  });

  it('shows the same icon in the four sizes', async () => {
    const { element } = await render();

    const sizes = [...element.querySelectorAll('[data-icon-size]')].map((item) =>
      item.getAttribute('data-icon-size'),
    );
    expect(sizes).toEqual(['sm', 'md', 'lg', 'xl']);
  });

  it('copies the semantic name on click and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { fixture, element } = await render();

    element.querySelector<HTMLButtonElement>('[data-icon-name="pallet"]')?.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith('pallet');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('pallet');
  });

  it('has no accessibility violations', async () => {
    const { element } = await render();
    await expectNoAxeViolations(element);
  });
});
