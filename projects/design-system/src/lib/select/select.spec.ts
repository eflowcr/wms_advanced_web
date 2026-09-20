import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import type { FieldSize } from '../field/field.types';
import { Select } from './select';
import type { SelectOption } from './select.types';

const OPTIONS: readonly SelectOption[] = [
  { label: 'Bodega central', value: 'BC' },
  { label: 'Bodega norte', value: 'BN' },
  { label: 'Bodega sur', value: 'BS' },
];

@Component({
  template: `
    <ewms-select
      [options]="options()"
      [size]="size()"
      [value]="value()"
      [label]="label()"
      [placeholder]="placeholder()"
      [hint]="hint()"
      [error]="error()"
      [disabled]="disabled()"
    />
  `,
  imports: [Select],
})
class TestHost {
  readonly options = signal<readonly SelectOption[]>(OPTIONS);
  readonly size = signal<FieldSize>('md');
  readonly value = signal<unknown>(null);
  readonly label = signal('Bodega');
  readonly placeholder = signal('Elegir bodega');
  readonly hint = signal('');
  readonly error = signal(false);
  readonly disabled = signal(false);
}

@Component({
  template: ` <ewms-select [options]="options" [label]="'Bodega'" [formControl]="control" /> `,
  imports: [Select, ReactiveFormsModule],
})
class ReactiveHost {
  readonly options = OPTIONS;
  readonly control = new FormControl<unknown>(null);
}

function key(name: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
}

describe('Select', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost, Select] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** The jsdom equivalent of `getByRole('combobox')`. */
  function trigger(): HTMLButtonElement {
    return (fixture.nativeElement as Element).querySelector(
      '[role="combobox"]',
    ) as HTMLButtonElement;
  }

  /** The panel is portalled into the CDK container at the end of <body>. */
  function listbox(): HTMLElement | null {
    return document.querySelector<HTMLElement>('.cdk-overlay-container [role="listbox"]');
  }

  function options(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
  }

  function option(index: number): HTMLElement {
    const found = options()[index];
    if (!found) {
      throw new Error(`No option at index ${index}`);
    }
    return found;
  }

  function instance(): Select {
    return fixture.debugElement.query(By.directive(Select)).componentInstance as Select;
  }

  async function openPanel(): Promise<void> {
    trigger().focus();
    trigger().click();
    await settle();
  }

  describe('Roles', () => {
    it('exposes a combobox closed and a listbox open', async () => {
      expect(trigger()).not.toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(listbox()).toBeNull();

      await openPanel();

      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      expect(listbox()).not.toBeNull();
      expect(options()).toHaveLength(OPTIONS.length);
    });

    it('is named by its visible label, and shows the value as its content', async () => {
      const labelId = trigger().getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      expect(
        (fixture.nativeElement as Element).querySelector(`#${labelId}`)?.textContent?.trim(),
      ).toBe('Bodega');

      // Nothing chosen yet: the content is the placeholder.
      expect(trigger().textContent?.trim()).toContain('Elegir bodega');

      host.value.set('BN');
      await settle();
      expect(trigger().textContent?.trim()).toContain('Bodega norte');
    });

    it('points aria-controls at the listbox only while it exists', async () => {
      // An id that is not in the document is an invalid attribute value, which
      // is worse than no attribute at all.
      expect(trigger().hasAttribute('aria-controls')).toBe(false);

      await openPanel();
      const controls = trigger().getAttribute('aria-controls');
      expect(controls).toBe(listbox()?.id);

      trigger().dispatchEvent(key('Escape'));
      await settle();
      expect(trigger().hasAttribute('aria-controls')).toBe(false);
    });

    it('renders every option passed, with no limit in the template', async () => {
      host.options.set(
        Array.from({ length: 120 }, (_unused, index) => ({
          label: `Ubicacion ${index}`,
          value: index,
        })),
      );
      await openPanel();

      expect(options()).toHaveLength(120);
    });
  });

  describe('Keyboard', () => {
    it('opens on ArrowDown and moves the active row down', async () => {
      trigger().focus();

      trigger().dispatchEvent(key('ArrowDown'));
      await settle();
      expect(listbox()).not.toBeNull();
      expect(trigger().getAttribute('aria-activedescendant')).toBe(option(0).id);

      trigger().dispatchEvent(key('ArrowDown'));
      await settle();
      expect(trigger().getAttribute('aria-activedescendant')).toBe(option(1).id);
    });

    it('moves the active row up, and stops at the ends instead of wrapping', async () => {
      trigger().focus();
      trigger().dispatchEvent(key('ArrowDown'));
      await settle();

      trigger().dispatchEvent(key('ArrowUp'));
      await settle();
      // Already at the top: holding the key must not loop back to the bottom
      // with no signal that the list has ended.
      expect(trigger().getAttribute('aria-activedescendant')).toBe(option(0).id);

      for (let i = 0; i < 10; i += 1) {
        trigger().dispatchEvent(key('ArrowDown'));
      }
      await settle();
      expect(trigger().getAttribute('aria-activedescendant')).toBe(option(OPTIONS.length - 1).id);
    });

    it('marks the active row with the same background the mouse produces', async () => {
      trigger().focus();
      trigger().dispatchEvent(key('ArrowDown'));
      await settle();

      expect(option(0).classList.contains('bg-ghost-hover')).toBe(true);
      expect(option(1).classList.contains('bg-ghost-hover')).toBe(false);
    });

    it('selects the active row on Enter and closes', async () => {
      trigger().focus();
      trigger().dispatchEvent(key('ArrowDown'));
      trigger().dispatchEvent(key('ArrowDown'));
      await settle();

      trigger().dispatchEvent(key('Enter'));
      await settle();

      expect(listbox()).toBeNull();
      expect(trigger().textContent?.trim()).toContain('Bodega norte');
    });

    it('CLOSES ON ESCAPE WITHOUT CHANGING THE VALUE', async () => {
      host.value.set('BC');
      await settle();
      const before = trigger().textContent?.trim();

      trigger().focus();
      trigger().dispatchEvent(key('ArrowDown'));
      trigger().dispatchEvent(key('ArrowDown'));
      await settle();
      // The active row is now a DIFFERENT option from the selected one.
      expect(trigger().getAttribute('aria-activedescendant')).toBe(option(1).id);

      trigger().dispatchEvent(key('Escape'));
      await settle();

      expect(listbox()).toBeNull();
      expect(trigger().textContent?.trim()).toBe(before);
    });

    it('closes on Tab without choosing anything', async () => {
      await openPanel();
      const before = trigger().textContent?.trim();

      trigger().dispatchEvent(key('Tab'));
      await settle();

      expect(listbox()).toBeNull();
      expect(trigger().textContent?.trim()).toBe(before);
    });

    it('drops aria-activedescendant when the panel closes', async () => {
      trigger().focus();
      trigger().dispatchEvent(key('ArrowDown'));
      await settle();
      expect(trigger().hasAttribute('aria-activedescendant')).toBe(true);

      trigger().dispatchEvent(key('Escape'));
      await settle();
      expect(trigger().hasAttribute('aria-activedescendant')).toBe(false);
    });

    it('opens on the current value, so the first arrow moves from there', async () => {
      host.value.set('BS');
      await settle();

      trigger().focus();
      trigger().click();
      await settle();

      expect(trigger().getAttribute('aria-activedescendant')).toBe(option(2).id);
    });

    it('ignores the keyboard entirely when disabled', async () => {
      host.disabled.set(true);
      await settle();

      trigger().dispatchEvent(key('ArrowDown'));
      await settle();
      expect(listbox()).toBeNull();
    });
  });

  describe('Focus', () => {
    it('never moves the focus off the trigger, whichever way the panel closes', async () => {
      await openPanel();
      expect(document.activeElement).toBe(trigger());

      trigger().dispatchEvent(key('Escape'));
      await settle();
      expect(document.activeElement).toBe(trigger());

      await openPanel();
      trigger().dispatchEvent(key('ArrowDown'));
      trigger().dispatchEvent(key('Enter'));
      await settle();
      expect(document.activeElement).toBe(trigger());
    });

    it('keeps the focus on the trigger when an option is clicked', async () => {
      await openPanel();

      // The focus moves on mousedown, before the click: the component prevents
      // that default, which is what keeps aria-activedescendant meaningful.
      const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      option(1).dispatchEvent(mousedown);
      expect(mousedown.defaultPrevented).toBe(true);

      option(1).click();
      await settle();

      expect(listbox()).toBeNull();
      expect(document.activeElement).toBe(trigger());
      expect(trigger().textContent?.trim()).toContain('Bodega norte');
    });
  });

  describe('Selection', () => {
    it('marks the chosen row selected, bold and checked', async () => {
      host.value.set('BN');
      await openPanel();

      expect(option(1).getAttribute('aria-selected')).toBe('true');
      expect(option(0).getAttribute('aria-selected')).toBe('false');
      expect(option(1).style.fontWeight).toBe('var(--text-control-selected-weight)');
      expect(option(1).classList.contains('text-(--color-bg-primary)')).toBe(true);
      expect(option(1).querySelector('ewms-icon[name="check"]')).not.toBeNull();
      expect(option(0).querySelector('ewms-icon[name="check"]')).toBeNull();
    });

    it('moves the active row with the pointer as well as the keyboard', async () => {
      await openPanel();

      option(2).dispatchEvent(new MouseEvent('mouseenter'));
      await settle();

      expect(trigger().getAttribute('aria-activedescendant')).toBe(option(2).id);
    });

    it('closes without choosing when the click lands outside', async () => {
      await openPanel();
      const before = trigger().textContent?.trim();

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();

      expect(listbox()).toBeNull();
      expect(trigger().textContent?.trim()).toBe(before);
    });
  });

  describe('Sizing and states', () => {
    // jsdom does no layout: the 32/40/48 heights and the 10/12/14 paddings are
    // asserted as the utilities that carry them, never as measurements. See
    // the PR report.
    const boxes: readonly (readonly [FieldSize, string, string])[] = [
      ['sm', 'h-8', 'px-2.5'],
      ['md', 'h-10', 'px-3'],
      ['lg', 'h-12', 'px-3.5'],
    ];

    it.each(boxes)('uses the Input scale at size "%s"', async (size, height, padding) => {
      host.size.set(size);
      await settle();

      // The same constants the Input reads, so a mixed form row lines up.
      expect(trigger().classList.contains(height)).toBe(true);
      expect(trigger().classList.contains(padding)).toBe(true);
      expect(trigger().classList.contains('rounded-control')).toBe(true);
    });

    it('uses a chevron at sm in all three sizes', async () => {
      for (const [size] of boxes) {
        host.size.set(size);
        await settle();

        const icon = fixture.debugElement.query(By.css('ewms-icon[name="chevron-down"]'));
        expect((icon.componentInstance as { size: () => string }).size()).toBe('sm');
      }
    });

    it('treats Open exactly like Focus for the border', async () => {
      const resting = trigger().style.borderColor;
      await openPanel();

      expect(trigger().style.borderColor).not.toBe(resting);

      trigger().dispatchEvent(key('Escape'));
      await settle();
      expect(trigger().style.borderColor).toBe(resting);
    });

    it('paints the error border and hint, and marks aria-invalid', async () => {
      host.hint.set('Elegi una bodega');
      host.error.set(true);
      await settle();

      expect(trigger().getAttribute('aria-invalid')).toBe('true');
      expect(
        (fixture.nativeElement as Element).querySelector('p')?.classList.contains('text-danger'),
      ).toBe(true);
      expect(trigger().getAttribute('aria-describedby')).toBeTruthy();
    });

    it('keeps the danger border when an error select is open', async () => {
      host.error.set(true);
      await settle();
      const errorBorder = trigger().style.borderColor;

      await openPanel();
      // One focus colour in the whole system: the ring says "focus", the
      // border keeps saying "error".
      expect(trigger().style.borderColor).toBe(errorBorder);
    });

    it('disables the trigger and refuses to open', async () => {
      host.disabled.set(true);
      await settle();

      expect(trigger().disabled).toBe(true);
      expect(trigger().classList.contains('cursor-not-allowed')).toBe(true);

      // The click and the keyboard are the only ways in, and both are refused.
      trigger().click();
      trigger().dispatchEvent(key('ArrowDown'));
      await settle();
      expect(listbox()).toBeNull();
    });

    it('lets the disabled INPUT win over a form that enables the control', async () => {
      host.disabled.set(true);
      await settle();

      instance().setDisabledState(false);
      await settle();
      expect(trigger().disabled).toBe(true);
    });
  });

  describe('Accessibility (axe)', () => {
    it('passes axe closed', async () => {
      host.hint.set('Elegi una bodega');
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe in error', async () => {
      host.error.set(true);
      host.hint.set('Elegi una bodega');
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe disabled', async () => {
      host.disabled.set(true);
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe open', async () => {
      host.value.set('BN');
      await openPanel();

      // The panel is portalled out of the component, so it is scanned where it
      // actually lives. The scope is the overlay container rather than
      // <body>: at body level axe also applies its page-level rules (every
      // region inside a landmark, and so on), which are about a document and
      // not about a component rendered on its own in a test.
      const container = document.querySelector('.cdk-overlay-container');
      expect(container).not.toBeNull();
      await expectNoAxeViolations(container as Element);
      await expectNoAxeViolations(fixture.nativeElement);
    });
  });
});

describe('Select with a reactive form', () => {
  let fixture: ComponentFixture<ReactiveHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveHost, Select, ReactiveFormsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function trigger(): HTMLButtonElement {
    return (fixture.nativeElement as Element).querySelector(
      '[role="combobox"]',
    ) as HTMLButtonElement;
  }

  it('writes the form value into the trigger', async () => {
    fixture.componentInstance.control.setValue('BS');
    await settle();

    expect(trigger().textContent?.trim()).toContain('Bodega sur');
  });

  it('reports a choice back to the form and marks it touched', async () => {
    trigger().click();
    await settle();

    const first = document.querySelector<HTMLElement>('[role="option"]');
    first?.click();
    await settle();

    expect(fixture.componentInstance.control.value).toBe('BC');
    expect(fixture.componentInstance.control.touched).toBe(true);
  });

  it('follows setDisabledState in both directions', async () => {
    fixture.componentInstance.control.disable();
    await settle();
    expect(trigger().disabled).toBe(true);

    fixture.componentInstance.control.enable();
    await settle();
    expect(trigger().disabled).toBe(false);
  });
});
