import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import { Toggle } from './toggle';

/** Los estados de la ficha: nombre, checked, disabled. */
const STATES: readonly (readonly [string, boolean, boolean])[] = [
  ['off', false, false],
  ['on', true, false],
  ['off and disabled', false, true],
  ['on and disabled', true, true],
];

@Component({
  template: `
    <ewms-toggle
      [checked]="checked()"
      [disabled]="disabled()"
      [label]="label()"
      [ariaLabel]="ariaLabel()"
      (checkedChange)="lastChange = $event"
    />
  `,
  imports: [Toggle],
})
class TestHost {
  readonly checked = signal(false);
  readonly disabled = signal(false);
  readonly label = signal('Alertas de stock bajo');
  readonly ariaLabel = signal('');

  lastChange: boolean | null = null;
}

@Component({
  template: ` <ewms-toggle [label]="'Modo compacto'" [formControl]="control" /> `,
  imports: [Toggle, ReactiveFormsModule],
})
class ReactiveHost {
  readonly control = new FormControl(false);
}

/**
 * Por métodos del DOM y no con un `FocusEvent` sintético: el nombre del segundo evento es una
 * utilidad de Tailwind y, como cadena, rompe la compuerta 10.
 */
function focusThenLeave(element: HTMLElement): void {
  element.focus();
  element.blur();
}

describe('Toggle', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost, Toggle] }).compileComponents();
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

  function track(): HTMLInputElement {
    return root().querySelector('input') as HTMLInputElement;
  }

  function thumb(): HTMLElement {
    return root().querySelector('span[aria-hidden="true"]') as HTMLElement;
  }

  function instance(): Toggle {
    return fixture.debugElement.query(By.directive(Toggle)).componentInstance as Toggle;
  }

  /** Como `getByRole` con nombre, en jsdom. */
  function switchByName(name: string): HTMLInputElement | null {
    return (
      Array.from(root().querySelectorAll<HTMLInputElement>('input[role="switch"]')).find(
        (element) =>
          element.getAttribute('aria-label') === name ||
          element.closest('label')?.textContent?.trim() === name,
      ) ?? null
    );
  }

  describe('Role and name', () => {
    it('is a switch, not a checkbox', () => {
      // Se anuncia encendido/apagado, no marcado/no marcado, que es vocabulario de selección.
      expect(track().getAttribute('role')).toBe('switch');
      expect(switchByName('Alertas de stock bajo')).toBe(track());
    });

    it('carries aria-checked, in step with the state', async () => {
      expect(track().getAttribute('aria-checked')).toBe('false');

      host.checked.set(true);
      await settle();
      expect(track().getAttribute('aria-checked')).toBe('true');
    });

    it('is named by ariaLabel when there is no visible text', async () => {
      host.label.set('');
      host.ariaLabel.set('Sincronizacion automatica');
      await settle();

      expect(switchByName('Sincronizacion automatica')).toBe(track());
      expect(root().textContent?.trim()).toBe('');
    });
  });

  describe('Hit target', () => {
    it('toggles from a click on the LABEL TEXT, not only on the track', async () => {
      const text = Array.from(root().querySelectorAll('label > span')).find(
        (element) => element.textContent?.trim() === 'Alertas de stock bajo',
      ) as HTMLElement;
      expect(text).toBeDefined();

      // El <label> que envuelve reenvía la activación: clave con guantes, donde 44x24 es poco.
      text.click();
      await settle();

      expect(host.lastChange).toBe(true);
      expect(track().checked).toBe(true);
    });

    it('toggles from a click on the track', async () => {
      track().click();
      await settle();

      expect(host.lastChange).toBe(true);
    });

    it('emits once per interaction, with the boolean and nothing else', async () => {
      track().click();
      await settle();
      expect(host.lastChange).toBe(true);

      track().click();
      await settle();
      expect(host.lastChange).toBe(false);
    });

    it('does not emit when disabled', async () => {
      host.disabled.set(true);
      await settle();

      track().click();
      await settle();
      expect(host.lastChange).toBeNull();
    });
  });

  describe('Track and thumb', () => {
    it('is a 44x24 pill at a single size', () => {
      // jsdom no hace layout: se afirman las utilidades, no el 44x24 medido.
      expect(track().classList.contains('w-11')).toBe(true);
      expect(track().classList.contains('h-6')).toBe(true);
      expect(track().classList.contains('rounded-full')).toBe(true);
    });

    it('moves the thumb across when it is on', async () => {
      expect(thumb().classList.contains('translate-x-0')).toBe(true);

      host.checked.set(true);
      await settle();
      expect(thumb().classList.contains('translate-x-5')).toBe(true);
      expect(thumb().classList.contains('translate-x-0')).toBe(false);
    });

    it('paints the track from the action blue when on and the strong border when off', async () => {
      expect(track().classList.contains('bg-(--color-border-strong)')).toBe(true);
      expect(track().classList.contains('hover:bg-(--color-border-strong-hover)')).toBe(true);

      host.checked.set(true);
      await settle();
      expect(track().classList.contains('bg-primary')).toBe(true);
      expect(track().classList.contains('hover:bg-(--color-bg-primary-hover)')).toBe(true);
    });

    it('drops every hover state when disabled, in both positions', async () => {
      host.disabled.set(true);
      await settle();
      expect(track().className).not.toContain('hover:');
      expect(track().classList.contains('bg-secondary')).toBe(true);

      host.checked.set(true);
      await settle();
      expect(track().className).not.toContain('hover:');
      expect(track().classList.contains('bg-(--color-bg-primary-disabled)')).toBe(true);
    });

    it('draws the focus ring on the track, from CSS', () => {
      expect(track().classList.contains('focus-visible:shadow-(--focus-ring-shadow)')).toBe(true);
      track().focus();
      expect(document.activeElement).toBe(track());
      expect(track().style.boxShadow).toBe('');
    });
  });

  describe('Disabled, from either source', () => {
    it('lets the disabled INPUT win over a form that enables the control', async () => {
      host.disabled.set(true);
      await settle();

      instance().setDisabledState(false);
      await settle();
      expect(track().disabled).toBe(true);
    });

    it('is disabled by the form alone when the input says nothing', async () => {
      instance().setDisabledState(true);
      await settle();
      expect(track().disabled).toBe(true);
    });
  });

  describe('Accessibility (axe)', () => {
    it.each(STATES)('passes axe in "%s"', async (_name, checked, disabled) => {
      host.checked.set(checked);
      host.disabled.set(disabled);
      await settle();

      await expectNoAxeViolations(root());
    });

    it.each(STATES)(
      'passes axe in "%s" with no visible label',
      async (_name, checked, disabled) => {
        host.label.set('');
        host.ariaLabel.set('Modo compacto de tabla');
        host.checked.set(checked);
        host.disabled.set(disabled);
        await settle();

        await expectNoAxeViolations(root());
      },
    );
  });
});

describe('Toggle with a reactive form', () => {
  let fixture: ComponentFixture<ReactiveHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveHost, Toggle, ReactiveFormsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function track(): HTMLInputElement {
    return (fixture.nativeElement as Element).querySelector('input') as HTMLInputElement;
  }

  it('writes the form value into the switch', async () => {
    fixture.componentInstance.control.setValue(true);
    await settle();
    expect(track().checked).toBe(true);
    expect(track().getAttribute('aria-checked')).toBe('true');
  });

  it('reports a flip back to the form', async () => {
    track().click();
    await settle();
    expect(fixture.componentInstance.control.value).toBe(true);
  });

  it('follows setDisabledState in both directions', async () => {
    fixture.componentInstance.control.disable();
    await settle();
    expect(track().disabled).toBe(true);

    fixture.componentInstance.control.enable();
    await settle();
    expect(track().disabled).toBe(false);
  });

  it('marks the control touched when the focus leaves, not on the flip', async () => {
    track().click();
    await settle();
    expect(fixture.componentInstance.control.touched).toBe(false);

    focusThenLeave(track());
    await settle();
    expect(fixture.componentInstance.control.touched).toBe(true);
  });
});
