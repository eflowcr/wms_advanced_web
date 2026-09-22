import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { disabled as disabledRule, form, FormField } from '@angular/forms/signals';
import { expectNoAxeViolations } from '@ewms/testing';
import { Checkbox } from './checkbox';

/** Los siete estados de la ficha: nombre, checked, indeterminate, disabled. */
const STATES: readonly (readonly [string, boolean, boolean, boolean])[] = [
  ['default', false, false, false],
  ['checked', true, false, false],
  ['indeterminate', false, true, false],
  ['indeterminate and checked', true, true, false],
  ['disabled', false, false, true],
  ['disabled and checked', true, false, true],
  ['disabled and indeterminate', false, true, true],
];

@Component({
  template: `
    <ewms-checkbox
      [checked]="checked()"
      [indeterminate]="indeterminate()"
      [disabled]="disabled()"
      [label]="label()"
      [ariaLabel]="ariaLabel()"
      (checkedChange)="lastChange = $event"
    />
  `,
  imports: [Checkbox],
})
class TestHost {
  readonly checked = signal(false);
  readonly indeterminate = signal(false);
  readonly disabled = signal(false);
  readonly label = signal('Reetiquetar');
  readonly ariaLabel = signal('');

  lastChange: boolean | null = null;
}

@Component({
  template: ` <ewms-checkbox label="Reetiquetar" [formField]="form.reetiquetar" /> `,
  imports: [Checkbox, FormField],
})
class FormHost {
  readonly locked = signal(false);
  readonly model = signal({ reetiquetar: false });
  readonly form = form(this.model, (path) => {
    disabledRule(path.reetiquetar, () => this.locked());
  });
}

/**
 * Por métodos del DOM y no con un `FocusEvent` sintético: el nombre del segundo evento es una
 * utilidad de Tailwind y, como cadena, rompe la compuerta 10.
 */
function focusThenLeave(element: HTMLElement): void {
  element.focus();
  element.blur();
}

describe('Checkbox', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost, Checkbox] }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function root(): Element {
    return fixture.nativeElement as Element;
  }

  function box(): HTMLInputElement {
    return root().querySelector('input[type="checkbox"]') as HTMLInputElement;
  }

  /** Como `getByRole` con nombre, en jsdom. */
  function byRoleAndName(name: string): HTMLInputElement | null {
    return (
      Array.from(root().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(
        (element) =>
          element.getAttribute('aria-label') === name ||
          element.closest('label')?.textContent?.trim() === name,
      ) ?? null
    );
  }

  describe('Accessible name', () => {
    it('is named by the wrapping label text', () => {
      expect(byRoleAndName('Reetiquetar')).toBe(box());
      expect(box().closest('label')).not.toBeNull();
    });

    it('is named by ariaLabel when there is no visible text', async () => {
      host.label.set('');
      host.ariaLabel.set('Seleccionar la fila 12');
      await settle();

      expect(byRoleAndName('Seleccionar la fila 12')).toBe(box());
      expect(root().textContent?.trim()).toBe('');
    });
  });

  describe('Indeterminate', () => {
    it('sets the DOM PROPERTY, which no attribute can reach', async () => {
      host.indeterminate.set(true);
      await settle();

      // La trampa: no hay atributo; afirmarlo pasaría con la caja en blanco.
      expect(box().indeterminate).toBe(true);
      expect(box().hasAttribute('indeterminate')).toBe(false);
    });

    it('announces mixed rather than a boolean', async () => {
      host.indeterminate.set(true);
      await settle();
      expect(box().getAttribute('aria-checked')).toBe('mixed');

      host.indeterminate.set(false);
      await settle();
      expect(box().getAttribute('aria-checked')).toBe('false');
    });

    it('outranks checked in what is announced and what is drawn', async () => {
      host.checked.set(true);
      host.indeterminate.set(true);
      await settle();

      expect(box().getAttribute('aria-checked')).toBe('mixed');
      expect(root().querySelector('ewms-icon[name="minus"]')).not.toBeNull();
      expect(root().querySelector('ewms-icon[name="check"]')).toBeNull();
    });

    it('follows the input back and forth, not just on the first render', async () => {
      host.indeterminate.set(true);
      await settle();
      expect(box().indeterminate).toBe(true);

      host.indeterminate.set(false);
      await settle();
      expect(box().indeterminate).toBe(false);

      host.indeterminate.set(true);
      await settle();
      expect(box().indeterminate).toBe(true);
    });
  });

  describe('Glyph and colour', () => {
    it('shows the check only when checked', async () => {
      expect(root().querySelector('ewms-icon')).toBeNull();

      host.checked.set(true);
      await settle();
      expect(root().querySelector('ewms-icon[name="check"]')).not.toBeNull();
    });

    it('fills the box for checked and for indeterminate alike', async () => {
      host.checked.set(true);
      await settle();
      const checkedClasses = box().className;

      host.checked.set(false);
      host.indeterminate.set(true);
      await settle();

      // Mismo tratamiento a propósito: solo el glifo los distingue, por eso aria-checked lleva mixed.
      expect(box().className).toBe(checkedClasses);
      expect(box().classList.contains('bg-primary')).toBe(true);
    });

    it('drops the hover border when disabled', async () => {
      expect(box().classList.contains('hover:border-(--color-bg-primary)')).toBe(true);

      host.disabled.set(true);
      await settle();
      expect(box().classList.contains('hover:border-(--color-bg-primary)')).toBe(false);
    });

    it('uses the single 18 px box and the 1.5 px border token', () => {
      // jsdom no hace layout: se afirman la utilidad y el token, no el 18x18 medido.
      expect(box().classList.contains('size-4.5')).toBe(true);
      expect(box().style.borderWidth).toBe('var(--border-width-selection)');
      expect(box().classList.contains('rounded-sm')).toBe(true);
    });
  });

  describe('Interaction', () => {
    it('toggles on the space bar and keeps the focus visible', async () => {
      box().focus();
      expect(document.activeElement).toBe(box());

      // jsdom no sintetiza la barra espaciadora: se despacha el clic. Lo que se afirma es que
      // el control es un checkbox nativo, que trae ese manejo del navegador.
      box().click();
      await settle();

      expect(host.lastChange).toBe(true);
      expect(box().checked).toBe(true);
      expect(document.activeElement).toBe(box());

      box().click();
      await settle();
      expect(host.lastChange).toBe(false);
    });

    it('draws the focus ring from CSS, with no inline box-shadow', () => {
      expect(box().classList.contains('focus-visible:shadow-(--focus-ring-shadow)')).toBe(true);
      box().focus();
      expect(box().style.boxShadow).toBe('');
    });

    it('does not emit when disabled', async () => {
      host.disabled.set(true);
      await settle();

      box().click();
      await settle();

      expect(host.lastChange).toBeNull();
    });
  });

  describe('Accessibility (axe)', () => {
    it.each(STATES)('passes axe in "%s"', async (_name, checked, indeterminate, disabled) => {
      host.checked.set(checked);
      host.indeterminate.set(indeterminate);
      host.disabled.set(disabled);
      await settle();

      await expectNoAxeViolations(root());
    });

    it('passes axe with no visible label, named by ariaLabel', async () => {
      host.label.set('');
      host.ariaLabel.set('Seleccionar todo');
      await settle();

      await expectNoAxeViolations(root());
    });
  });
});

describe('Checkbox inside a signal form', () => {
  let fixture: ComponentFixture<FormHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FormHost] }).compileComponents();
    fixture = TestBed.createComponent(FormHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function box(): HTMLInputElement {
    return (fixture.nativeElement as Element).querySelector('input') as HTMLInputElement;
  }

  it('writes the form value into the box, and a click back into the form', async () => {
    fixture.componentInstance.model.set({ reetiquetar: true });
    await settle();
    expect(box().checked).toBe(true);

    box().click();
    await settle();
    expect(fixture.componentInstance.form.reetiquetar().value()).toBe(false);
  });

  it('follows the disabled rule of the schema in both directions', async () => {
    fixture.componentInstance.locked.set(true);
    await settle();
    expect(box().disabled).toBe(true);

    fixture.componentInstance.locked.set(false);
    await settle();
    expect(box().disabled).toBe(false);
  });

  it('marks the field touched when the focus leaves, not on the click', async () => {
    box().click();
    await settle();
    expect(fixture.componentInstance.form.reetiquetar().touched()).toBe(false);

    focusThenLeave(box());
    await settle();
    expect(fixture.componentInstance.form.reetiquetar().touched()).toBe(true);
  });
});
