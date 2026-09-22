import { Component, viewChild } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { expectNoAxeViolations } from '@ewms/testing';
import { Button } from '../button/button';
import { Checkbox } from '../checkbox/checkbox';
import { Input as TextInput } from '../input/input';
import { ShortcutsHost } from '../keyboard/shortcuts-host';
import {
  EWMS_SHORTCUT_HELP_MESSAGES,
  EWMS_SHORTCUT_MAP,
  type ShortcutHelpMessages,
  type ShortcutMap,
} from '../keyboard/shortcuts.types';
import { confirmDiscard } from './confirm-discard';
import { DialogService } from '../dialog/dialog.service';
import { FormPattern } from './form-pattern';
import { EWMS_FORM_MESSAGES, NO_FORM_MESSAGES, type FormMessages } from './form.types';

const MAP: ShortcutMap = {
  search: { key: '/', chord: ['/'] },
  create: { key: 'n', alt: true, chord: ['Alt', 'N'] },
  save: { key: 's', ctrl: true, insideTextFields: true, chord: ['Ctrl', 'S'] },
  cancel: { key: 'Escape', insideTextFields: true, chord: ['Esc'] },
  filters: { key: 'r', alt: true, chord: ['Alt', 'R'] },
  moveColumnLeft: { key: 'ArrowLeft', alt: true, shift: true, chord: ['Alt', 'Shift', '←'] },
  moveColumnRight: { key: 'ArrowRight', alt: true, shift: true, chord: ['Alt', 'Shift', '→'] },
  help: { key: '?', chord: ['?'] },
};

const MESSAGES: FormMessages = {
  errors: {
    ...NO_FORM_MESSAGES.errors,
    required: () => 'Este campo es obligatorio',
    minLength: (limit) => `Mínimo ${limit}`,
    pattern: () => 'El formato no es el esperado',
  },
  customError: () => '',
  errorSummary: (count) => `Revisá ${count} campos`,
  errorSummaryLabel: 'Error',
  requiredLegend: '* obligatorio',
};

@Component({
  template: `
    <div ewmsShortcutsHost>
      <form ewmsForm [formGroup]="form" (formSubmit)="saved = saved + 1">
        <ewms-input label="Código" formControlName="codigo" data-codigo />
        <ewms-input label="Cliente" formControlName="cliente" data-cliente />
        <ewms-checkbox label="Etiquetas impresas" formControlName="etiquetas" data-etiquetas />
        <ewms-button type="submit" [loading]="pattern().busy()" data-save>Guardar</ewms-button>
      </form>
    </div>
  `,
  imports: [Button, Checkbox, FormPattern, ReactiveFormsModule, ShortcutsHost, TextInput],
})
class TestHost {
  readonly pattern = viewChild.required(FormPattern);
  saved = 0;
  readonly form = new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^EXP-\d{4}$/)],
    }),
    cliente: new FormControl('', { nonNullable: true, validators: [Validators.minLength(3)] }),
    etiquetas: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });
}

describe('FormPattern', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const form = (): HTMLFormElement => root().querySelector('form') as HTMLFormElement;
  const summary = (): HTMLElement | null => root().querySelector('[data-form-errors]');
  const notes = (): string[] =>
    [...root().querySelectorAll('p.text-danger, span.text-danger')].map(
      (note) => note.textContent?.trim() ?? '',
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        { provide: EWMS_FORM_MESSAGES, useValue: MESSAGES },
        { provide: EWMS_SHORTCUT_MAP, useValue: MAP },
        { provide: EWMS_SHORTCUT_HELP_MESSAGES, useValue: {} as ShortcutHelpMessages },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
    await settle();
  });

  afterEach(() => fixture.nativeElement.remove());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const box = root().querySelector(`${selector} input`) as HTMLInputElement;
    box.value = value;
    box.dispatchEvent(new Event('input'));
  }

  it('NEVER SUBMITS INVALID: it marks every field, writes the summary and focuses it', async () => {
    form().requestSubmit();
    await settle();

    expect(host.saved).toBe(0);
    // Todos los mensajes, aunque no se haya visitado el campo. Cliente no: `minlength` no
    // reclama un campo vacío, que es lo que debe hacer (para eso está `required`).
    expect(notes()).toEqual(['Este campo es obligatorio', 'Este campo es obligatorio']);
    expect(summary()?.textContent).toContain('Revisá 2 campos');
    expect(document.activeElement?.tagName).toBe('EWMS-FORM-ERRORS');

    // Un enlace por campo, que enfoca el suyo.
    const links = [...root().querySelectorAll<HTMLButtonElement>('[data-form-error]')];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Código', 'Etiquetas impresas']);
    links[1]?.click();
    expect(document.activeElement).toBe(root().querySelector('[data-etiquetas] input'));

    // Enviar otra vez reusa el mismo resumen en vez de apilar banners.
    form().requestSubmit();
    await settle();
    expect(root().querySelectorAll('[data-form-errors]').length).toBe(1);
  });

  it('a field says what failed when it is left, not while it is being typed', async () => {
    type('[data-codigo]', 'EXP');
    await settle();
    expect(notes()).toEqual([]);

    const box = root().querySelector('[data-codigo] input') as HTMLInputElement;
    box.focus();
    box.blur();
    await settle();
    expect(notes()).toEqual(['El formato no es el esperado']);
  });

  it('SUBMITS ONCE when it is valid, and keeps the button busy until the consumer answers', async () => {
    type('[data-codigo]', 'EXP-0001');
    type('[data-cliente]', 'Andes');
    const box = root().querySelector('[data-etiquetas] input') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await settle();

    // Ctrl+S desde un campo del formulario, por el mapa de atajos: la misma puerta que «Guardar».
    root().querySelector<HTMLInputElement>('[data-codigo] input')?.focus();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }),
    );
    await settle();

    expect(host.saved).toBe(1);
    expect(summary()).toBeNull();
    expect(root().querySelector('[data-save] button')?.getAttribute('aria-busy')).toBe('true');

    host.pattern().done();
    await settle();
    expect(root().querySelector('[data-save] button')?.getAttribute('aria-busy')).toBeNull();
  });

  it('has no axe violations with the summary showing', async () => {
    form().requestSubmit();
    await settle();
    await expectNoAxeViolations(root());
  });
});

describe('el formulario sin resumen y sin palabras', () => {
  @Component({
    template: `
      <form ewmsForm [summary]="false" [formGroup]="form" (formSubmit)="saved = saved + 1">
        <ewms-input label="Código" formControlName="codigo" data-codigo />
      </form>
    `,
    imports: [FormPattern, ReactiveFormsModule, TextInput],
  })
  class BareHost {
    saved = 0;
    readonly form = new FormGroup({
      codigo: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    });
  }

  it('sin proveedor de textos no dice nada, y con `summary` en false no dibuja el banner', async () => {
    // Sin EWMS_FORM_MESSAGES: el campo queda mudo, pero el formulario sigue sin enviar.
    await TestBed.configureTestingModule({ imports: [BareHost] }).compileComponents();
    const fixture = TestBed.createComponent(BareHost);
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.saved).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-form-errors]')).toBeNull();
    expect(fixture.nativeElement.querySelector('p.text-danger')).toBeNull();
    expect(NO_FORM_MESSAGES.errors.required(null)).toBe('');
    expect(NO_FORM_MESSAGES.errorSummary(2)).toBe('');
  });
});

describe('confirmDiscard', () => {
  it('pregunta solo si el formulario está sucio', async () => {
    let asked = 0;
    TestBed.configureTestingModule({
      providers: [
        { provide: DialogService, useValue: { confirm: () => ((asked += 1), Promise.resolve(false)) } },
      ],
    });
    const options = {
      title: 'Hay cambios sin guardar',
      body: '¿Salir igual?',
      tone: 'danger' as const,
      confirmLabel: 'Salir',
      cancelLabel: 'Seguir',
    };
    // El `inject` corre en el contexto; lo que se espera, afuera (tras un await ya no hay contexto).
    expect(TestBed.runInInjectionContext(() => confirmDiscard({ dirty: false }, options))).toBe(true);
    expect(asked).toBe(0);
    const answer = TestBed.runInInjectionContext(() => confirmDiscard({ dirty: true }, options));
    expect(await answer).toBe(false);
    expect(asked).toBe(1);
  });
});
