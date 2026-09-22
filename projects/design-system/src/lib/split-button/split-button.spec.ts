import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '@ewms/testing';
import { SplitButton, type SplitAction } from './split-button';
import { EWMS_SPLIT_BUTTON_MESSAGES } from './split-button.types';

const FORMATS: readonly SplitAction[] = [
  { id: 'pdf', label: 'PDF', icon: 'file-text' },
  { id: 'xlsx', label: 'Excel', disabled: true },
  { id: 'csv', label: 'CSV' },
];

@Component({
  template: `
    <ewms-split-button
      label="Descargar"
      icon="download"
      [actions]="formats"
      (primary)="chosen.push('primary')"
      (action)="chosen.push($event)"
    />
  `,
  imports: [SplitButton],
})
class TestHost {
  readonly formats = FORMATS;
  readonly chosen: string[] = [];
}

describe('SplitButton', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        { provide: EWMS_SPLIT_BUTTON_MESSAGES, useValue: { moreActions: 'Más formatos' } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    document.body.appendChild(fixture.nativeElement);
    await settle();
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

  function buttons(): HTMLButtonElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  }

  function trigger(): HTMLButtonElement {
    return buttons()[1]!;
  }

  function menu(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="menu"]');
  }

  async function press(target: HTMLElement, key: string): Promise<KeyboardEvent> {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    await settle();
    return event;
  }

  function active(): string | null {
    const id = menu()?.getAttribute('aria-activedescendant');
    return id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null;
  }

  it('is two real buttons: the main action, and a named trigger that says it is closed', async () => {
    expect(buttons()[0]?.textContent).toContain('Descargar');
    expect(trigger().getAttribute('aria-label')).toBe('Más formatos');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    buttons()[0]!.click();
    await settle();
    expect(fixture.componentInstance.chosen).toEqual(['primary']);
    expect(menu()).toBeNull();
  });

  it('APG: ArrowDown opens on the first item, the arrows skip the disabled one, Enter chooses', async () => {
    await press(trigger(), 'ArrowDown');
    await Promise.resolve();

    expect(menu()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(menu()?.id);
    expect(document.activeElement).toBe(menu());
    expect(active()).toBe('PDF');

    await press(menu()!, 'ArrowDown');
    expect(active()).toBe('CSV');

    await press(menu()!, 'Enter');
    expect(fixture.componentInstance.chosen).toEqual(['csv']);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('ArrowUp opens on the last item; Escape closes and gives the focus back', async () => {
    await press(trigger(), 'ArrowUp');
    expect(active()).toBe('CSV');

    const escape = await press(menu()!, 'Escape');
    expect(escape.defaultPrevented).toBe(true);
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(fixture.componentInstance.chosen).toEqual([]);
  });

  it('a click on the trigger toggles it, and a disabled item cannot be chosen', async () => {
    trigger().click();
    await settle();
    expect(menu()).not.toBeNull();

    document.querySelector<HTMLElement>('[data-split-action="xlsx"]')!.click();
    await settle();
    expect(fixture.componentInstance.chosen).toEqual([]);

    trigger().click();
    await settle();
    expect(menu()).toBeNull();
  });

  it('passes axe closed and with the menu open', async () => {
    await expectNoAxeViolations(fixture.nativeElement);

    await press(trigger(), 'ArrowDown');
    await expectNoAxeViolations(document.querySelector('.cdk-overlay-container')!);
  });
});
