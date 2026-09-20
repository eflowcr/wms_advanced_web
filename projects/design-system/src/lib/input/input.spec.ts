import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { expectNoAxeViolations } from '@ewms/testing';
import type { FieldSize, FieldState } from '../field/field.types';
import { Input } from './input';
import type { InputType } from './input.types';

const TYPES: readonly InputType[] = ['text', 'number', 'password', 'search', 'textarea'];
const STATES: readonly FieldState[] = ['default', 'error', 'disabled', 'readonly'];
const SIZES: readonly FieldSize[] = ['sm', 'md', 'lg'];

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
  template: ` <ewms-input [label]="'Lote'" [formControl]="control" /> `,
  imports: [Input, ReactiveFormsModule],
})
class ReactiveHost {
  readonly control = new FormControl('');
}

/**
 * The jsdom equivalent of `getByLabelText`: resolve the <label> whose text is
 * `text`, follow its `for`, and return what it points at. Deliberately goes
 * through the for/id pair rather than querying the control directly -- that
 * pair IS the criterion.
 */
function byLabelText(root: Element, text: string): HTMLElement | null {
  const label = Array.from(root.querySelectorAll('label')).find(
    (element) => element.textContent?.trim().replace(/\*$/, '').trim() === text,
  );
  const id = label?.getAttribute('for');
  return id ? root.querySelector<HTMLElement>(`#${id}`) : null;
}

/**
 * Give an element the focus, then take it away, driving the two native events
 * through the DOM methods rather than through a synthesised `FocusEvent`.
 *
 * The reason is gate 10: it reads every string literal in a .ts file as a
 * possible class name, and the name of the second of those two events is also
 * a stock Tailwind filter utility, so spelling it as a literal fails the
 * build. The method call says the same thing and is closer to what a browser
 * actually does. Reported in the PR report.
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
      // The native attribute already announces it; the glyph would say it twice.
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
      // The name is still only the label.
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

      // The whole point of the state: not editable, but still focusable,
      // selectable and NOT announced as unavailable.
      expect((control() as HTMLInputElement).readOnly).toBe(true);
      expect(control().disabled).toBe(false);
      expect(control().hasAttribute('aria-disabled')).toBe(false);
      expect(control().classList.contains('cursor-default')).toBe(true);
      expect(control().classList.contains('cursor-not-allowed')).toBe(false);
      // Read-only text is content someone may need to read: primary, not grey.
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

      // One focus colour in the whole system: the ring says "focus", the
      // border keeps saying "error".
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
    // jsdom does no layout: getBoundingClientRect returns zeroes and
    // getComputedStyle does not resolve var(). The 32/40/48 heights and the
    // 10/12/14 paddings are asserted as the utilities that carry them, never
    // as measurements -- a measurement assertion here would pass by comparing
    // zero with zero. See the PR report.
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
      // Same radius and border as the single-line field: they come from the
      // one shared base class list.
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
        // 16 px at every field size, so a Small button and a Large input on the
        // same row carry the same glyph.
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
      return root().querySelector('ewms-icon-button button') as HTMLButtonElement;
    }

    it('alternates the native type and keeps the focus on the button', async () => {
      expect(control().getAttribute('type')).toBe('password');

      toggle().focus();
      expect(document.activeElement).toBe(toggle());

      toggle().click();
      await settle();

      expect(control().getAttribute('type')).toBe('text');
      // Nothing in the toggle path calls focus() or swaps the element.
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

      // The alternative would be a button with no accessible name. See the
      // comment on showPasswordLabel and the PR report.
      expect(root().querySelector('ewms-icon-button')).toBeNull();
    });
  });

  describe('Search clear', () => {
    beforeEach(async () => {
      host.type.set('search');
      host.clearLabel.set('Limpiar');
      await settle();
    });

    it('appears only once there is something to clear', async () => {
      expect(root().querySelector('ewms-icon-button')).toBeNull();

      control().value = 'pallet';
      control().dispatchEvent(new Event('input'));
      await settle();

      expect(root().querySelector('ewms-icon-button')).not.toBeNull();
    });

    it('empties the field when pressed', async () => {
      control().value = 'pallet';
      control().dispatchEvent(new Event('input'));
      await settle();

      (root().querySelector('ewms-icon-button button') as HTMLButtonElement).click();
      await settle();

      expect(control().value).toBe('');
      expect(root().querySelector('ewms-icon-button')).toBeNull();
    });
  });

  describe('Focus outputs', () => {
    it('emits one of each per native event', async () => {
      // Bound from the host template with the prefixed names. The unprefixed
      // pair would not compile past ESLint's no-output-native, and one of the
      // two is also a stock Tailwind utility name, which gate 10 reads as a
      // dead class when it appears in an inline template. See the comment on
      // those outputs and the PR report.
      focusThenLeave(control());
      await settle();

      expect(host.focusCount).toBe(1);
      expect(host.leaveCount).toBe(1);
    });
  });

  describe('Disabled, from either source', () => {
    function instance(): Input {
      return fixture.debugElement.query(By.directive(Input)).componentInstance as Input;
    }

    it('lets the disabled INPUT win over a form that enables the control', async () => {
      host.disabled.set(true);
      await settle();

      // The form's half of the decision, called the way Angular calls it.
      // Neither source can re-enable what the other disabled: a template that
      // says [disabled]="true" is not undone by form.enable().
      instance().setDisabledState(false);
      await settle();

      expect(control().disabled).toBe(true);
    });

    it('is disabled by the form alone when the input says nothing', async () => {
      instance().setDisabledState(true);
      await settle();
      expect(control().disabled).toBe(true);
    });

    it('is disabled by state="disabled" alone', async () => {
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

describe('Input with a reactive form', () => {
  let fixture: ComponentFixture<ReactiveHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveHost, Input, ReactiveFormsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(ReactiveHost);
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

  it('writes the form value into the field', async () => {
    fixture.componentInstance.control.setValue('L-0042');
    await settle();

    expect(field().value).toBe('L-0042');
  });

  it('reports typing back to the form', async () => {
    field().value = 'L-0099';
    field().dispatchEvent(new Event('input'));
    await settle();

    expect(fixture.componentInstance.control.value).toBe('L-0099');
  });

  it('marks the control touched when the focus leaves, not on typing', async () => {
    field().value = 'L-0099';
    field().dispatchEvent(new Event('input'));
    await settle();
    expect(fixture.componentInstance.control.touched).toBe(false);

    focusThenLeave(field());
    await settle();
    expect(fixture.componentInstance.control.touched).toBe(true);
  });

  it('follows setDisabledState in both directions', async () => {
    fixture.componentInstance.control.disable();
    await settle();
    expect(field().disabled).toBe(true);

    fixture.componentInstance.control.enable();
    await settle();
    expect(field().disabled).toBe(false);
  });
});
