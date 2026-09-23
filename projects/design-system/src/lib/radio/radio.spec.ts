import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { expectNoAxeViolations } from '@ewms/testing';
import { EWMS_FORM_MESSAGES, NO_FORM_MESSAGES, type FormMessages } from '../forms/form.types';
import { Radio } from './radio';
import { RadioGroup } from './radio-group';

const MESSAGES: FormMessages = {
  ...NO_FORM_MESSAGES,
  errors: { ...NO_FORM_MESSAGES.errors, required: () => 'Elegí un tipo de recepción' },
};

/** El grupo dentro de un formulario de señales, como se usa de verdad. */
@Component({
  template: `
    <ewms-radio-group label="Tipo de recepción" hint="El almacén lo pide" [formField]="tipo">
      <ewms-radio [value]="'ciega'" [label]="label()" />
      <ewms-radio [value]="'con-orden'" label="Contra orden de compra" [disabled]="lockSecond()" />
    </ewms-radio-group>
  `,
  imports: [Radio, RadioGroup, FormField],
})
class GroupHost {
  readonly label = signal('Recepcion ciega');
  readonly lockSecond = signal(false);
  readonly locked = signal(false);
  readonly model = signal<{ tipo: string | null }>({ tipo: null });
  readonly form = form(this.model, (path) => {
    required(path.tipo);
    disabled(path.tipo, () => this.locked());
  });
  readonly tipo = this.form.tipo;
}

/** Sin formulario: el grupo se ata con `[(value)]` y nombra sus radios igual. */
@Component({
  template: `
    <ewms-radio-group
      label="Tipo de recepción"
      name="aislado"
      [(value)]="chosen"
      [disabled]="off()"
    >
      <ewms-radio [value]="'solo'" [label]="label()" [ariaLabel]="ariaLabel()" />
    </ewms-radio-group>
  `,
  imports: [Radio, RadioGroup],
})
class PlainHost {
  readonly label = signal('Recepcion ciega');
  readonly ariaLabel = signal('');
  readonly off = signal(false);
  readonly chosen = signal<unknown>(null);
}

/**
 * Por métodos del DOM y no con un `FocusEvent` sintético: el nombre del segundo evento es una
 * utilidad de Tailwind y, como cadena, rompe la compuerta 10.
 */
function focusThenLeave(element: HTMLElement): void {
  element.focus();
  element.blur();
}

describe('RadioGroup', () => {
  let fixture: ComponentFixture<GroupHost>;
  let host: GroupHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupHost],
      providers: [{ provide: EWMS_FORM_MESSAGES, useValue: MESSAGES }],
    }).compileComponents();
    fixture = TestBed.createComponent(GroupHost);
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

  function radios(): HTMLInputElement[] {
    return Array.from(root().querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  }

  /** `strict` prohíbe un índice sin chequear; el fixture siempre pinta los dos. */
  function radio(index: number): HTMLInputElement {
    const found = radios()[index];
    if (!found) {
      throw new Error(`No radio at index ${index}`);
    }
    return found;
  }

  /** Como `getByRole` con nombre, en jsdom. */
  function byRoleAndName(name: string): HTMLInputElement | null {
    return (
      radios().find(
        (element) =>
          element.getAttribute('aria-label') === name ||
          element.closest('label')?.textContent?.trim() === name,
      ) ?? null
    );
  }

  function note(): string {
    return root().querySelector('p')?.textContent?.trim() ?? '';
  }

  describe('Accessible name', () => {
    it('names the group by its legend and each option by its label', () => {
      expect(root().querySelector('legend')?.textContent?.trim()).toContain('Tipo de recepción');
      expect(byRoleAndName('Recepcion ciega')).toBe(radio(0));
      expect(byRoleAndName('Contra orden de compra')).toBe(radio(1));
    });
  });

  describe('Grouping', () => {
    it('puts every option of the group on the same generated name', () => {
      const [first, second] = radios().map((element) => element.name);
      expect(first).toBeTruthy();
      expect(second).toBe(first);
    });

    it('excludes the siblings when one is picked', async () => {
      radio(0).click();
      await settle();

      expect(radio(0).checked).toBe(true);
      expect(radio(1).checked).toBe(false);
      expect(host.form.tipo().value()).toBe('ciega');

      radio(1).click();
      await settle();

      // El navegador desmarca el primero; el valor del campo confirma que coinciden.
      expect(radio(0).checked).toBe(false);
      expect(radio(1).checked).toBe(true);
      expect(host.form.tipo().value()).toBe('con-orden');
    });

    it('derives checked by comparing the group value, never by storing it', async () => {
      host.model.set({ tipo: 'con-orden' });
      await settle();

      expect(radio(0).checked).toBe(false);
      expect(radio(1).checked).toBe(true);
      expect(radio(1).getAttribute('aria-checked')).toBe('true');
      expect(radio(0).getAttribute('aria-checked')).toBe('false');
    });

    it('adds the disabled of the option to the one of the group, never subtracts it', async () => {
      host.lockSecond.set(true);
      await settle();
      expect(radio(0).disabled).toBe(false);
      expect(radio(1).disabled).toBe(true);

      host.locked.set(true);
      await settle();
      expect(radio(0).disabled).toBe(true);
    });
  });

  describe('Validation', () => {
    it('shows the hint until the focus leaves, then the failing validator, once', async () => {
      expect(note()).toBe('El almacén lo pide');

      focusThenLeave(radio(0));
      await settle();

      expect(host.form.tipo().touched()).toBe(true);
      expect(note()).toBe('Elegí un tipo de recepción');
      // Un mensaje por grupo, no uno por opción.
      expect(root().querySelectorAll('p')).toHaveLength(1);
    });

    it('marks the whole group required, with one asterisk in the legend', () => {
      expect(radios().every((element) => element.required)).toBe(true);
      expect(root().querySelector('legend span')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Appearance', () => {
    it('is a circle on the same 18 px box and 1.5 px border as the checkbox', () => {
      // jsdom no hace layout: el 18x18 y el punto de 8x8 no se miden.
      expect(radio(0).classList.contains('size-4.5')).toBe(true);
      expect(radio(0).classList.contains('rounded-full')).toBe(true);
      expect(radio(0).style.borderWidth).toBe('var(--border-width-selection)');
    });

    it('shows the dot only when selected', async () => {
      expect(root().querySelectorAll('.size-2')).toHaveLength(0);

      host.model.set({ tipo: 'ciega' });
      await settle();
      expect(root().querySelectorAll('.size-2')).toHaveLength(1);
    });

    it('draws the focus ring from CSS, with no inline box-shadow', () => {
      expect(radio(0).classList.contains('focus-visible:shadow-(--focus-ring-shadow)')).toBe(true);
      radio(0).focus();
      expect(radio(0).style.boxShadow).toBe('');
      expect(document.activeElement).toBe(radio(0));
    });
  });

  describe('Accessibility (axe)', () => {
    const states: readonly (readonly [string, string | null])[] = [
      ['default', null],
      ['checked', 'ciega'],
    ];

    it.each(states)('passes axe in "%s"', async (_name, value) => {
      host.model.set({ tipo: value });
      await settle();

      await expectNoAxeViolations(root());
    });
  });
});

describe('RadioGroup, outside a form', () => {
  let fixture: ComponentFixture<PlainHost>;
  let host: PlainHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlainHost] }).compileComponents();
    fixture = TestBed.createComponent(PlainHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function input(): HTMLInputElement {
    return (fixture.nativeElement as Element).querySelector('input') as HTMLInputElement;
  }

  it('takes the name of the group and writes back through [(value)]', async () => {
    expect(input().name).toBe('aislado');

    input().click();
    await settle();
    expect(host.chosen()).toBe('solo');
  });

  it('is named by ariaLabel when there is no visible text', async () => {
    host.label.set('');
    host.ariaLabel.set('Recepcion ciega');
    await settle();

    expect(input().getAttribute('aria-label')).toBe('Recepcion ciega');
  });

  it('drops the hover border and refuses the pick when the group is disabled', async () => {
    expect(input().classList.contains('hover:border-(--color-bg-primary)')).toBe(true);

    host.off.set(true);
    await settle();

    expect(input().disabled).toBe(true);
    expect(input().classList.contains('hover:border-(--color-bg-primary)')).toBe(false);
  });

  const disabledStates: readonly (readonly [string, unknown])[] = [
    ['disabled', null],
    ['disabled and checked', 'solo'],
  ];

  it.each(disabledStates)('passes axe in "%s"', async (_name, value) => {
    host.chosen.set(value);
    host.off.set(true);
    await settle();

    await expectNoAxeViolations(fixture.nativeElement);
  });
});
