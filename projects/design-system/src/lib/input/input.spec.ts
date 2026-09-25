import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { disabled, form, FormField, minLength, required, validate } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import { EWMS_FORM_MESSAGES, NO_FORM_MESSAGES, type FormMessages } from '../forms/form.types';
import type { FieldSize, FieldState } from '../field/field.types';
import { Input } from './input';
import type { InputType } from './input.types';

const TYPES: readonly InputType[] = ['text', 'number', 'password', 'search', 'textarea'];
const STATES: readonly FieldState[] = ['default', 'error', 'disabled', 'readonly'];
const SIZES: readonly FieldSize[] = ['sm', 'md', 'lg'];

const MESSAGES: FormMessages = {
  ...NO_FORM_MESSAGES,
  errors: { ...NO_FORM_MESSAGES.errors, minLength: (limit) => `Mínimo ${limit} caracteres` },
  customError: () => 'Revise este campo',
};

@Component({
  template: `
    <ewms-input
      [type]="type()"
      [size]="size()"
      [label]="label()"
      [placeholder]="placeholder()"
      [hint]="hint()"
      [state]="state()"
      [required]="required()"
      [disabled]="disabled()"
      [showPasswordLabel]="showPasswordLabel()"
      [hidePasswordLabel]="hidePasswordLabel()"
      [clearLabel]="clearLabel()"
      (fieldFocus)="focusCount = focusCount + 1"
      (fieldBlur)="leaveCount = leaveCount + 1"
    />
  `,
  imports: [Input],
})
class TestHost {
  readonly type = signal<InputType>('text');
  readonly size = signal<FieldSize>('md');
  readonly label = signal('Codigo de articulo');
  readonly placeholder = signal('');
  readonly hint = signal('');
  readonly state = signal<FieldState>('default');
  readonly required = signal(false);
  readonly disabled = signal(false);
  readonly showPasswordLabel = signal('');
  readonly hidePasswordLabel = signal('');
  readonly clearLabel = signal('');

  focusCount = 0;
  leaveCount = 0;
}

@Component({
  template: ` <ewms-input label="Lote" hint="Tres letras" [formField]="lote" /> `,
  imports: [Input, FormField],
})
class FormHost {
  /** Dos validadores propios: uno trae su texto, el otro no. El `kind` decide cuál corre. */
  readonly own = signal<'none' | 'withMessage' | 'withoutMessage'>('none');

  readonly locked = signal(false);
  readonly model = signal({ lote: '' });
  readonly form = form(this.model, (path) => {
    required(path.lote);
    minLength(path.lote, 3);
    disabled(path.lote, () => this.locked());
    validate(path.lote, () => {
      if (this.own() === 'withMessage') {
        return { kind: 'shipmentCode', message: 'El código de expedición es EXP-0000' };
      }
      return this.own() === 'withoutMessage' ? { kind: 'unaCosaRara' } : undefined;
    });
  });
  readonly lote = this.form.lote;
}

/** Como `getByLabelText`: pasa por el par for/id a propósito, porque ese par es el criterio. */
function byLabelText(root: Element, text: string): HTMLElement | null {
  const label = Array.from(root.querySelectorAll('label')).find(
    (element) => element.textContent?.trim().replace(/\*$/, '').trim() === text,
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector<HTMLElement>(`#${id}`) : null;
}

/**
 * Por métodos del DOM y no con un `FocusEvent` sintético: el nombre del segundo evento es una
 * utilidad de Tailwind y, como cadena, rompe la compuerta 10.
 */
function focusThenLeave(element: HTMLElement): void {
  element.focus();
  element.blur();
}

describe('Input', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHost, Input] }).compileComponents();
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

  function control(): HTMLInputElement | HTMLTextAreaElement {
    return root().querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
  }

  describe('Accessible name', () => {
    it.each(TYPES)('is found by its label text in type "%s"', async (type) => {
      host.type.set(type);
      await settle();

      const found = byLabelText(root(), 'Codigo de articulo');
      expect(found).not.toBeNull();
      expect(found).toBe(control());
    });

    it('renders textarea for the textarea type and a single-line input otherwise', async () => {
      host.type.set('textarea');
      await settle();
      expect(root().querySelector('textarea')).not.toBeNull();
      expect(root().querySelector('input')).toBeNull();

      host.type.set('text');
      await settle();
      expect(root().querySelector('textarea')).toBeNull();
      expect(root().querySelector('input')).not.toBeNull();
    });

    it('keeps the placeholder out of the name: the label is the name', async () => {
      host.placeholder.set('ABC-123');
      await settle();

      expect(control().getAttribute('placeholder')).toBe('ABC-123');
      expect(byLabelText(root(), 'Codigo de articulo')).toBe(control());
    });

    it('marks required natively and hides the asterisk from assistive tech', async () => {
      host.required.set(true);
      await settle();

      expect(control().required).toBe(true);
      expect(root().querySelector('label span')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Hint', () => {
    it('is announced as a description, not as the name', async () => {
      host.hint.set('Formato ABC-123');
      await settle();

      const describedBy = control().getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(root().querySelector(`#${describedBy}`)?.textContent?.trim()).toBe('Formato ABC-123');
      // El nombre sigue siendo solo la etiqueta.
      expect(byLabelText(root(), 'Codigo de articulo')).toBe(control());
    });

    it('describes the field by nothing when there is no hint', () => {
      expect(control().hasAttribute('aria-describedby')).toBe(false);
    });

    it('turns danger-coloured in error and secondary otherwise', async () => {
      host.hint.set('Formato ABC-123');
      host.state.set('error');
      await settle();
      expect(root().querySelector('p')?.classList.contains('text-danger')).toBe(true);

      host.state.set('default');
      await settle();
      expect(root().querySelector('p')?.classList.contains('text-secondary')).toBe(true);
    });
  });

  describe('States', () => {
    it('marks aria-invalid in error, and nowhere else', async () => {
      host.state.set('error');
      await settle();
      expect(control().getAttribute('aria-invalid')).toBe('true');

      host.state.set('default');
      await settle();
      expect(control().hasAttribute('aria-invalid')).toBe(false);
    });

    it('does not announce read-only as disabled', async () => {
      host.state.set('readonly');
      await settle();

      // No editable, pero enfocable, seleccionable y no anunciado como no disponible.
      expect((control() as HTMLInputElement).readOnly).toBe(true);
      expect(control().disabled).toBe(false);
      expect(control().hasAttribute('aria-disabled')).toBe(false);
      expect(control().classList.contains('cursor-default')).toBe(true);
      expect(control().classList.contains('cursor-not-allowed')).toBe(false);
      // Solo lectura es contenido que se lee: color primario, no gris.
      expect(control().classList.contains('text-disabled')).toBe(false);
    });

    it('applies the native disabled attribute in the disabled state', async () => {
      host.state.set('disabled');
      await settle();

      expect(control().disabled).toBe(true);
      expect((control() as HTMLInputElement).readOnly).toBe(false);
      expect(control().classList.contains('cursor-not-allowed')).toBe(true);
    });

    it('keeps the danger border when an error field also has focus', async () => {
      host.state.set('error');
      await settle();

      const before = control().style.borderColor;
      control().focus();
      await settle();

      // El anillo dice «foco» y el borde sigue diciendo «error».
      expect(control().style.borderColor).toBe(before);
      expect(control().classList.contains('focus-visible:shadow-(--focus-ring-shadow)')).toBe(true);
    });

    it('swaps the border to the action blue on focus in the default state', async () => {
      const resting = control().style.borderColor;
      control().focus();
      await settle();
      const focused = control().style.borderColor;

      expect(focused).not.toBe(resting);

      control().blur();
      await settle();
      expect(control().style.borderColor).toBe(resting);
    });
  });

  describe('Sizing', () => {
    // jsdom no hace layout: alturas 32/40/48 y rellenos 10/12/14 se afirman por la utilidad
    // que los lleva; medir compararía cero con cero.
    const boxes: readonly (readonly [FieldSize, string, string])[] = [
      ['sm', 'h-8', 'px-2.5'],
      ['md', 'h-10', 'px-3'],
      ['lg', 'h-12', 'px-3.5'],
    ];

    it.each(boxes)('uses the control scale at size "%s"', async (size, height, padding) => {
      host.size.set(size);
      await settle();

      expect(control().classList.contains(height)).toBe(true);
      expect(control().classList.contains(padding)).toBe(true);
    });

    it('drops the fixed height for the textarea and stops it being resized', async () => {
      host.type.set('textarea');
      await settle();

      expect(control().classList.contains('h-10')).toBe(false);
      expect(control().classList.contains('resize-none')).toBe(true);
      expect(control().classList.contains('rounded-control')).toBe(true);
    });

    it('right-aligns numbers and left-aligns everything else', async () => {
      host.type.set('number');
      await settle();
      expect(control().classList.contains('text-right')).toBe(true);

      host.type.set('text');
      await settle();
      expect(control().classList.contains('text-left')).toBe(true);
    });
  });

  describe('Icons', () => {
    it('renders the search glyph as decoration, at sm in all three sizes', async () => {
      host.type.set('search');

      for (const size of SIZES) {
        host.size.set(size);
        await settle();

        const icon = fixture.debugElement.query(By.css('ewms-icon'));
        expect(icon).not.toBeNull();
        // 16 px en todo tamaño: botón chico y campo grande en una fila llevan el mismo glifo.
        expect((icon.componentInstance as { size: () => string }).size()).toBe('sm');
        const svg = (icon.nativeElement as Element).querySelector('svg');
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect(svg?.hasAttribute('aria-label')).toBe(false);
      }
    });

    it('leaves the field with no prefix icon for the other types', async () => {
      host.type.set('text');
      await settle();
      expect(fixture.debugElement.query(By.css('ewms-icon'))).toBeNull();
    });
  });

  describe('Password show/hide', () => {
    beforeEach(async () => {
      host.type.set('password');
      host.showPasswordLabel.set('Mostrar contrasena');
      host.hidePasswordLabel.set('Ocultar contrasena');
      await settle();
    });

    function toggle(): HTMLButtonElement {
      return root().querySelector('ewms-button button') as HTMLButtonElement;
    }

    it('alternates the native type and keeps the focus on the button', async () => {
      expect(control().getAttribute('type')).toBe('password');

      toggle().focus();
      expect(document.activeElement).toBe(toggle());

      toggle().click();
      await settle();

      expect(control().getAttribute('type')).toBe('text');
      expect(document.activeElement).toBe(toggle());

      toggle().click();
      await settle();
      expect(control().getAttribute('type')).toBe('password');
      expect(document.activeElement).toBe(toggle());
    });

    it('names the button after what the next press will do', async () => {
      expect(toggle().getAttribute('aria-label')).toBe('Mostrar contrasena');

      toggle().click();
      await settle();
      expect(toggle().getAttribute('aria-label')).toBe('Ocultar contrasena');
    });

    it('renders no button at all when the consumer supplied no text for it', async () => {
      host.showPasswordLabel.set('');
      host.hidePasswordLabel.set('');
      await settle();

      // La alternativa sería un botón sin nombre accesible.
      expect(root().querySelector('ewms-button')).toBeNull();
    });
  });

  describe('Search clear', () => {
    beforeEach(async () => {
      host.type.set('search');
      host.clearLabel.set('Limpiar');
      await settle();
    });

    it('appears only once there is something to clear', async () => {
      expect(root().querySelector('ewms-button')).toBeNull();

      control().value = 'pallet';
      control().dispatchEvent(new Event('input'));
      await settle();

      expect(root().querySelector('ewms-button')).not.toBeNull();
    });

    it('empties the field when pressed', async () => {
      control().value = 'pallet';
      control().dispatchEvent(new Event('input'));
      await settle();

      (root().querySelector('ewms-button button') as HTMLButtonElement).click();
      await settle();

      expect(control().value).toBe('');
      expect(root().querySelector('ewms-button')).toBeNull();
    });
  });

  describe('Focus outputs', () => {
    it('emits one of each per native event', async () => {
      // Con los nombres prefijados; ver el comentario de esas salidas en input.ts.
      focusThenLeave(control());
      await settle();

      expect(host.focusCount).toBe(1);
      expect(host.leaveCount).toBe(1);
    });
  });

  describe('Disabled', () => {
    it('is disabled by the entrada, or by state="disabled"', async () => {
      host.disabled.set(true);
      await settle();
      expect(control().disabled).toBe(true);

      host.disabled.set(false);
      host.state.set('disabled');
      await settle();
      expect(control().disabled).toBe(true);
    });
  });

  describe('Accessibility (axe)', () => {
    it.each(TYPES)('passes axe for type "%s"', async (type) => {
      host.type.set(type);
      host.hint.set('Formato ABC-123');
      host.showPasswordLabel.set('Mostrar contrasena');
      host.hidePasswordLabel.set('Ocultar contrasena');
      host.clearLabel.set('Limpiar');
      await settle();

      await expectNoAxeViolations(root());
    });

    it.each(STATES)('passes axe in state "%s"', async (state) => {
      host.state.set(state);
      host.hint.set('Formato ABC-123');
      await settle();

      await expectNoAxeViolations(root());
    });

    it('passes axe when disabled through the input rather than the state', async () => {
      host.disabled.set(true);
      await settle();

      await expectNoAxeViolations(root());
    });
  });
});

describe('Input inside a signal form', () => {
  let fixture: ComponentFixture<FormHost>;
  let host: FormHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormHost, Input],
      providers: [{ provide: EWMS_FORM_MESSAGES, useValue: MESSAGES }],
    }).compileComponents();
    fixture = TestBed.createComponent(FormHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function field(): HTMLInputElement {
    return (fixture.nativeElement as Element).querySelector('input') as HTMLInputElement;
  }

  function note(): string {
    return (fixture.nativeElement as Element).querySelector('p')?.textContent?.trim() ?? '';
  }

  it('writes the form value into the field, and typing back into the form', async () => {
    host.model.set({ lote: 'L-0042' });
    await settle();
    expect(field().value).toBe('L-0042');

    field().value = 'L-0099';
    field().dispatchEvent(new Event('input'));
    await settle();
    expect(host.form.lote().value()).toBe('L-0099');
  });

  it('marks the field touched when the focus leaves, not on typing', async () => {
    field().value = 'L-0099';
    field().dispatchEvent(new Event('input'));
    await settle();
    expect(host.form.lote().touched()).toBe(false);

    focusThenLeave(field());
    await settle();
    expect(host.form.lote().touched()).toBe(true);
  });

  it('shows the hint while typing and the failing validator after leaving', async () => {
    expect(note()).toBe('Tres letras');

    field().value = 'ab';
    field().dispatchEvent(new Event('input'));
    await settle();
    // Todavía el hint: se valida al salir, nunca mientras se escribe.
    expect(note()).toBe('Tres letras');
    expect(field().hasAttribute('aria-invalid')).toBe(false);

    focusThenLeave(field());
    await settle();
    expect(note()).toBe('Mínimo 3 caracteres');
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toBeTruthy();
  });

  it('prefers the message of the validator, and falls back to the token by kind', async () => {
    host.model.set({ lote: 'ABC' });
    host.own.set('withMessage');
    focusThenLeave(field());
    await settle();
    // El texto del validador gana sobre la tabla del token (§2.1).
    expect(note()).toBe('El código de expedición es EXP-0000');

    host.own.set('withoutMessage');
    await settle();
    // Un `kind` que la tabla no nombra y sin `message`: queda el texto de `customError`.
    expect(note()).toBe('Revise este campo');
  });

  it('takes the asterisk and the native required from the schema', () => {
    expect(field().required).toBe(true);
    expect(
      (fixture.nativeElement as Element).querySelector('label span')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  // Deshabilitar dentro de un formulario va por `disabled(path.x)` del esquema: Angular
  // prohíbe `[disabled]` en el mismo nodo que `[formField]` (NG8022).
  it('is disabled by the schema rule', async () => {
    host.locked.set(true);
    await settle();
    expect(field().disabled).toBe(true);
  });
});
