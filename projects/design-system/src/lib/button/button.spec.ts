import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
        [disabled]="disabled()"
        [loading]="loading()"
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
  readonly disabled = signal(false);
  readonly loading = signal(false);

  buttonClicked = false;

  onButtonClick(_event: MouseEvent): void {
    this.buttonClicked = true;
  }
}

/** Formulario, campo y botón reales (DS-5): el envío es del navegador, no de un atributo. */
@Component({
  template: `
    <form data-form (ngSubmit)="submits = submits + 1">
      <input data-field name="codigo" />
      <ewms-button [type]="type()" [loading]="loading()">Guardar</ewms-button>
    </form>
  `,
  imports: [Button, FormsModule],
})
class FormHost {
  readonly type = signal<'button' | 'submit'>('submit');
  readonly loading = signal(false);
  submits = 0;
}

describe('Button, inside a form', () => {
  let fixture: ComponentFixture<FormHost>;
  let host: FormHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FormHost] }).compileComponents();
    fixture = TestBed.createComponent(FormHost);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
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

  it('submits the form when it is asked to', async () => {
    button().click();
    await settle();

    expect(host.submits).toBe(1);
  });

  it('AND `Enter` IN A FIELD SUBMITS IT, which is the whole point', async () => {
    // El envío implícito necesita un botón submit; sin él, Enter no guardaba. Ver vault: Boton.
    const field = fixture.nativeElement.querySelector('[data-field]') as HTMLInputElement;
    field.focus();
    fixture.nativeElement.querySelector('[data-form]').requestSubmit();
    await settle();

    expect(host.submits).toBe(1);
  });

  it('and does NOT submit while the default is left alone', async () => {
    // `button` sigue siendo el default: nada anterior a DS-5 empieza a enviar.
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
    await TestBed.configureTestingModule({
      imports: [TestHost, Button],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    parentClicked = false;

    const parent = fixture.nativeElement.querySelector('#parent-container');
    parent?.addEventListener('click', () => {
      parentClicked = true;
    });

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders a native button with accessible name matching projected text', () => {
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Save Changes');
  });

  describe('Loading pattern', () => {
    it('keeps accessible name via aria-labelledby and marks aria-busy and aria-disabled during loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.hasAttribute('disabled')).toBe(false);

      const labelId = button.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();

      const content = fixture.nativeElement.querySelector(`#${labelId}`);
      expect(content).not.toBeNull();
      expect(content?.textContent).toContain('Save Changes');
      expect(content?.classList.contains('invisible')).toBe(true);

      const spinner = fixture.debugElement.query(By.css('ewms-icon[name="spinner"]'));
      expect(spinner).not.toBeNull();
    });

    it('suppresses (click) and stops native event bubbling to parent during loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      button.click();

      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('suppresses Enter keydown events during loading', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const buttonDebug = fixture.debugElement.query(By.css('button'));
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      buttonDebug.nativeElement.dispatchEvent(event);

      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('retains focus when entering loading state', async () => {
      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      button.focus();
      expect(document.activeElement).toBe(button);

      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(button);
    });
  });

  describe('Disabled state', () => {
    it('applies native disabled attribute and prevents clicks', async () => {
      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.hasAttribute('aria-disabled')).toBe(false);

      button.click();
      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });

    it('keeps the native disabled attribute when disabled and loading are both set', async () => {
      host.disabled.set(true);
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      // Independientes: deshabilitado sigue así mientras carga; solo se suma `aria-busy`.
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect(button.hasAttribute('aria-disabled')).toBe(false);

      button.click();
      expect(host.buttonClicked).toBe(false);
      expect(parentClicked).toBe(false);
    });
  });

  describe('Focus ring', () => {
    it('draws the ring from CSS on :focus-visible, with no inline box-shadow', () => {
      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;

      // jsdom no resuelve var() ni :focus-visible: se afirma la clase y que TypeScript no
      // escribe la sombra.
      expect(button.classList.contains('focus-visible:shadow-(--focus-ring-shadow)')).toBe(true);
      expect(button.style.boxShadow).toBe('');

      button.focus();
      expect(button.style.boxShadow).toBe('');
    });
  });

  describe('Icon integration', () => {
    it('renders icon with aria-hidden when icon input is provided', async () => {
      host.icon.set('package');
      host.iconPosition.set('left');
      fixture.detectChanges();
      await fixture.whenStable();

      // Las entradas de Angular no se reflejan como atributos: se busca por directiva.
      const icons = fixture.debugElement.queryAll(By.directive(Icon));
      expect(icons.length).toBeGreaterThan(0);
      const firstIcon = icons[0];
      if (!firstIcon) throw new Error('No ewms-icon found in template');
      const iconEl = firstIcon.nativeElement as Element;
      expect(iconEl.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Accessibility (axe)', () => {
    const variants: readonly ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];

    it.each(variants)('passes axe accessibility checks for variant "%s"', async (variant) => {
      host.variant.set(variant);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe accessibility checks in loading state', async () => {
      host.loading.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });

    it('passes axe accessibility checks in disabled state', async () => {
      host.disabled.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      await expectNoAxeViolations(fixture.nativeElement);
    });
  });
});
