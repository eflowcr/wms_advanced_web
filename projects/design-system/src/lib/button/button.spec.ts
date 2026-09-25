import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import type { IconName } from '../../icons/icons.generated';
import { Icon } from '../icon/icon';
import { Button } from './button';
import type { ButtonIconPosition, ButtonSize, ButtonVariant } from './button.types';

@Component({
  template: `
    <div id="parent-container">
      <ewms-button
        [variant]="variant()"
        [size]="size()"
        [icon]="icon()"
        [iconPosition]="iconPosition()"
        [iconOnly]="iconOnly()"
        [label]="label()"
        [disabled]="disabled()"
        [loading]="loading()"
        [pressed]="pressed()"
        [expanded]="expanded()"
        [controls]="controls()"
        (click)="onButtonClick($event)"
      >
        Save Changes
      </ewms-button>
    </div>
  `,
  imports: [Button],
})
class TestHost {
  readonly variant = signal<ButtonVariant>('primary');
  readonly size = signal<ButtonSize>('md');
  readonly icon = signal<IconName | null>(null);
  readonly iconPosition = signal<ButtonIconPosition>('left');
  readonly iconOnly = signal(false);
  readonly label = signal<string | null>(null);
  readonly disabled = signal(false);
  readonly loading = signal(false);
  readonly pressed = signal<boolean | null>(null);
  readonly expanded = signal<boolean | null>(null);
  readonly controls = signal<string | null>(null);

  buttonClicked = false;

  onButtonClick(_event: MouseEvent): void {
    this.buttonClicked = true;
  }
}

/** Formulario, campo y botón reales (DS-5): el envío es del navegador, no de un atributo. */
@Component({
  template: `
    <!-- El evento nativo, sin NgForm: lo que se prueba es que el botón envíe el formulario. -->
    <form data-form (submit)="onSubmit($event)">
      <input data-field name="codigo" />
      <ewms-button [type]="type()" [loading]="loading()">Guardar</ewms-button>
    </form>
  `,
  imports: [Button],
})
class FormHost {
  readonly type = signal<'button' | 'submit'>('submit');
  readonly loading = signal(false);
  submits = 0;

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submits += 1;
  }
}

describe('Button, inside a form', () => {
  let fixture: ComponentFixture<FormHost>;
  let host: FormHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FormHost] }).compileComponents();
    fixture = TestBed.createComponent(FormHost);
    host = fixture.componentInstance;
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

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('ewms-button button') as HTMLButtonElement;
  }

  it('submits on click AND on Enter in a field, which is the whole point', async () => {
    // El envío implícito necesita un botón submit; sin él, Enter no guardaba. Ver vault: Boton.
    button().click();
    (fixture.nativeElement.querySelector('[data-form]') as HTMLFormElement).requestSubmit();
    await settle();

    expect(host.submits).toBe(2);
  });

  it('does NOT submit while the default is left alone', async () => {
    host.type.set('button');
    await settle();

    button().click();
    await settle();

    expect(host.submits).toBe(0);
    expect(button().getAttribute('type')).toBe('button');
  });

  it('the anti-double-submit pattern still holds: loading blocks the second', async () => {
    host.loading.set(true);
    await settle();

    button().click();
    button().click();
    await settle();

    expect(host.submits).toBe(0);
  });
});

describe('Button', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let parentClicked: boolean;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    parentClicked = false;
    fixture.nativeElement.querySelector('#parent-container')?.addEventListener('click', () => {
      parentClicked = true;
    });
    await settle();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function button(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
  }

  /** Como getByRole con nombre, en jsdom: aria-label o el contenido referido. */
  function accessibleName(): string {
    const labelledBy = button().getAttribute('aria-labelledby');
    if (labelledBy) {
      return fixture.nativeElement.querySelector(`#${labelledBy}`)?.textContent?.trim() ?? '';
    }
    return button().getAttribute('aria-label') ?? '';
  }

  async function asIconOnly(): Promise<void> {
    host.iconOnly.set(true);
    host.icon.set('trash');
    host.label.set('Eliminar');
    host.variant.set('ghost');
    await settle();
  }

  it('is named by its projected text', () => {
    expect(accessibleName()).toBe('Save Changes');
    expect(button().hasAttribute('aria-label')).toBe(false);
  });

  it('renders its icon decorative, on the chosen side', async () => {
    host.icon.set('package');
    host.iconPosition.set('right');
    await settle();

    const content = button().querySelector('span');
    const icon = fixture.debugElement.query(By.directive(Icon)).nativeElement as Element;
    expect(icon.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(content?.lastElementChild).toBe(icon);
  });

  describe('Loading pattern', () => {
    beforeEach(async () => {
      host.loading.set(true);
      await settle();
    });

    it('keeps the name and focus, marks busy, and hides the content with visibility', () => {
      expect(button().getAttribute('aria-busy')).toBe('true');
      expect(button().getAttribute('aria-disabled')).toBe('true');
      // Sin `disabled` nativo: conserva el foco mientras carga.
      expect(button().hasAttribute('disabled')).toBe(false);
      expect(accessibleName()).toBe('Save Changes');
      expect(button().querySelector('span')?.classList.contains('invisible')).toBe(true);
      expect(fixture.debugElement.query(By.css('ewms-icon[name="spinner"]'))).not.toBeNull();
    });

    it('suppresses click and Enter, and stops bubbling to a parent listener', () => {
      button().click();
      button().dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );

      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('retains focus when entering loading', async () => {
      host.loading.set(false);
      await settle();
      button().focus();

      host.loading.set(true);
      await settle();

      expect(document.activeElement).toBe(button());
    });
  });

  describe('Disabled state', () => {
    it('uses the native attribute, even while loading, and blocks clicks', async () => {
      host.disabled.set(true);
      host.loading.set(true);
      await settle();

      // Independientes: deshabilitado sigue así mientras carga; solo se suma `aria-busy`.
      expect(button().disabled).toBe(true);
      expect(button().getAttribute('aria-busy')).toBe('true');
      expect(button().hasAttribute('aria-disabled')).toBe(false);

      button().click();
      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });
  });

  it('draws the focus ring from CSS on :focus-visible, with no inline box-shadow', () => {
    // jsdom no resuelve var() ni :focus-visible: se afirma la clase y que TS no escribe sombra.
    expect(button().classList.contains('focus-visible:shadow-(--focus-ring-shadow)')).toBe(true);
    button().focus();
    expect(button().style.boxShadow).toBe('');
  });

  describe('Icon only', () => {
    it('is named by label, not by the icon, and drops the projected text', async () => {
      await asIconOnly();

      expect(button().getAttribute('aria-label')).toBe('Eliminar');
      expect(button().hasAttribute('aria-labelledby')).toBe(false);
      expect(button().textContent?.trim()).toBe('');
    });

    const boxes: readonly (readonly [ButtonSize, string, string])[] = [
      ['sm', 'h-8 w-8', 'sm'],
      ['md', 'h-10 w-10', 'md'],
      // md a propósito: dos tamaños de icono en una barra se leen como un error.
      ['lg', 'h-12 w-12', 'md'],
    ];

    it.each(boxes)('is a square box at size "%s"', async (size, box, iconSize) => {
      await asIconOnly();
      host.size.set(size);
      await settle();

      // Cuadrada por construcción; la caja pintada la mide e2e/showroom.e2e.ts.
      for (const utility of box.split(' ')) {
        expect(button().classList.contains(utility)).toBe(true);
      }
      expect([...button().classList].some((name) => name.startsWith('px-'))).toBe(false);
      const icon = fixture.debugElement.query(By.directive(Icon)).componentInstance as Icon;
      expect(icon.size()).toBe(iconSize);
    });

    it('shows label as a tooltip on focus, hidden from the name it repeats', async () => {
      await asIconOnly();

      button().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      const panel = document.querySelector('.cdk-overlay-container div[id^="ewms-tooltip-"]');
      expect(panel?.textContent).toBe('Eliminar');
      expect(panel?.getAttribute('aria-hidden')).toBe('true');
      expect(button().hasAttribute('aria-describedby')).toBe(false);
      button().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    it('has no tooltip when there is text to read', () => {
      button().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      fixture.detectChanges();

      expect(document.querySelector('div[id^="ewms-tooltip-"]')).toBeNull();
    });

    it('fails in dev mode without a label, rather than render a nameless button', () => {
      const fresh = TestBed.createComponent(TestHost);
      fresh.componentInstance.iconOnly.set(true);
      expect(() => fresh.detectChanges()).toThrow(/iconOnly requires a label/);
    });
  });

  describe('Link variant', () => {
    const classes = (): string[] => [...button().classList];

    beforeEach(async () => {
      host.variant.set('link');
      await settle();
    });

    it('is text on no background or border, one tone deeper on hover, with an underline', () => {
      expect(classes()).toContain('text-(color:--color-bg-primary-hover)');
      expect(classes()).toContain('hover:underline');
      expect(classes()).toContain('bg-transparent');
      expect(classes().some((name) => name.startsWith('border'))).toBe(false);
      expect(classes().some((name) => name.startsWith('hover:bg-'))).toBe(false);
      expect(classes()).toContain('focus-visible:shadow-(--focus-ring-shadow)');
    });

    const heights: readonly (readonly [ButtonSize, string])[] = [
      ['sm', 'h-8'],
      ['md', 'h-10'],
    ];

    it.each(heights)(
      'keeps the control height at size "%s", with a short padding',
      async (size, height) => {
        host.size.set(size);
        await settle();

        expect(classes()).toContain(height);
        expect(classes().filter((name) => name.startsWith('px-'))).toEqual(['px-2']);
      },
    );

    it('follows the same disabled contract: native attribute, no hover, no click', async () => {
      host.disabled.set(true);
      await settle();

      expect(button().disabled).toBe(true);
      expect(classes()).toContain('text-disabled');
      expect(classes()).not.toContain('hover:underline');
      button().click();
      expect(host.buttonClicked).toBe(false);
    });

    it('follows the same loading contract, with the spinner in its own tone', async () => {
      host.loading.set(true);
      await settle();

      expect(button().getAttribute('aria-busy')).toBe('true');
      expect(button().getAttribute('aria-disabled')).toBe('true');
      expect(accessibleName()).toBe('Save Changes');
      const spinner = button().querySelector<HTMLElement>('span[aria-hidden="true"]');
      expect(spinner?.style.color).toBe('var(--color-bg-primary-hover)');
      button().click();
      expect(host.buttonClicked).toBe(false);
    });

    it('fails in dev mode as icon only or at size lg, which a link does not come in', () => {
      const iconOnly = TestBed.createComponent(TestHost);
      iconOnly.componentInstance.variant.set('link');
      iconOnly.componentInstance.iconOnly.set(true);
      iconOnly.componentInstance.label.set('Reintentar');
      expect(() => iconOnly.detectChanges()).toThrow(/variant="link"/);

      const large = TestBed.createComponent(TestHost);
      large.componentInstance.variant.set('link');
      large.componentInstance.size.set('lg');
      expect(() => large.detectChanges()).toThrow(/variant="link"/);
    });
  });

  it('exposes pressed, expanded and controls only when they are set', async () => {
    expect(button().hasAttribute('aria-pressed')).toBe(false);
    expect(button().hasAttribute('aria-expanded')).toBe(false);

    host.pressed.set(false);
    host.expanded.set(true);
    host.controls.set('panel-1');
    await settle();

    // `false` sí se escribe: un conmutador apagado sigue siendo conmutador.
    expect(button().getAttribute('aria-pressed')).toBe('false');
    expect(button().getAttribute('aria-expanded')).toBe('true');
    expect(button().getAttribute('aria-controls')).toBe('panel-1');
  });

  describe('Accessibility (axe)', () => {
    const variants: readonly ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];

    it.each(variants)('passes axe with text and icon only, variant "%s"', async (variant) => {
      host.variant.set(variant);
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);

      await asIconOnly();
      host.variant.set(variant);
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe as a link, resting, loading and disabled', async () => {
      host.variant.set('link');
      host.size.set('sm');
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);

      host.loading.set(true);
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);

      host.loading.set(false);
      host.disabled.set(true);
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe loading and disabled', async () => {
      host.loading.set(true);
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);

      host.loading.set(false);
      host.disabled.set(true);
      await settle();
      await expectNoAxeViolations(fixture.nativeElement);
    });
  });
});
