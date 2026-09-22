import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  form,
  FormField,
  minLength,
  pattern as patternRule,
  required,
  requiredError,
  validate,
} from '@angular/forms/signals';
import { expectNoAxeViolations } from '@ewms/testing';
import { Button } from '../button/button';
import { Card } from '../card/card';
import { CardGroup } from '../card/card-group';
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

interface Alta {
  codigo: string;
  cliente: string;
  etiquetas: boolean;
}

@Component({
  template: `
    <div ewmsShortcutsHost>
      <form [ewmsForm]="alta" [ewmsFormAction]="guardar" #pat="ewmsForm">
        <ewms-input label="Código" [formField]="alta.codigo" data-codigo />
        <ewms-input label="Cliente" [formField]="alta.cliente" data-cliente />
        <ewms-checkbox label="Etiquetas impresas" [formField]="alta.etiquetas" data-etiquetas />
        <ewms-button type="submit" [loading]="pat.busy()" data-save>Guardar</ewms-button>
      </form>
    </div>
  `,
  imports: [Button, Checkbox, FormField, FormPattern, ShortcutsHost, TextInput],
})
class TestHost {
  saved = 0;
  private release: (() => void) | null = null;

  readonly model = signal<Alta>({ codigo: '', cliente: '', etiquetas: false });

  readonly alta = form(this.model, (path) => {
    required(path.codigo);
    patternRule(path.codigo, /^EXP-\d{4}$/);
    minLength(path.cliente, 3);
    // El equivalente de `requiredTrue`: `required` mira si está vacío, y `false` no lo está.
    validate(path.etiquetas, ({ value }) => (value() ? undefined : requiredError()));
  });

  /** Queda pendiente hasta que la prueba la suelta: así se mira el botón en carga. */
  readonly guardar = async (): Promise<void> => {
    this.saved += 1;
    await new Promise<void>((resolve) => {
      this.release = resolve;
    });
  };

  done(): void {
    this.release?.();
    this.release = null;
  }
}

describe('FormPattern', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const formEl = (): HTMLFormElement => root().querySelector('form') as HTMLFormElement;
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
    formEl().requestSubmit();
    await settle();

    expect(host.saved).toBe(0);
    // Todos los mensajes, aunque no se haya visitado el campo. Cliente no: `minLength` no
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
    formEl().requestSubmit();
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

  it('SUBMITS ONCE when it is valid, and keeps the button busy until the action resolves', async () => {
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

    // Antidoble envío: mientras la acción corre, otro envío no la vuelve a correr.
    formEl().requestSubmit();
    await settle();
    expect(host.saved).toBe(1);

    host.done();
    // Dos vueltas: la promesa resuelve en una microtarea y `submitting()` baja en el `finally`.
    await settle();
    await settle();
    expect(root().querySelector('[data-save] button')?.getAttribute('aria-busy')).toBeNull();
  });

  it('has no axe violations with the summary showing', async () => {
    formEl().requestSubmit();
    await settle();
    await expectNoAxeViolations(root());
  });
});

describe('el formulario sin resumen y sin palabras', () => {
  @Component({
    template: `
      <form [ewmsForm]="alta" [ewmsFormAction]="guardar" [summary]="false">
        <ewms-input label="Código" [formField]="alta.codigo" data-codigo />
      </form>
    `,
    imports: [FormField, FormPattern, TextInput],
  })
  class BareHost {
    saved = 0;
    readonly model = signal({ codigo: '' });
    readonly alta = form(this.model, (path) => {
      required(path.codigo);
    });
    readonly guardar = (): void => {
      this.saved += 1;
    };
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

describe('el resumen nombra un campo que no tiene etiqueta', () => {
  @Component({
    template: `
      <form [ewmsForm]="alta" [ewmsFormAction]="guardar">
        <ewms-card-group label="Almacén" [formField]="alta.almacen">
          <ewms-card optionValue="norte"><span>Norte</span></ewms-card>
          <ewms-card optionValue="central"><span>Central</span></ewms-card>
        </ewms-card-group>
      </form>
    `,
    imports: [Card, CardGroup, FormField, FormPattern],
  })
  class GroupHost {
    readonly model = signal<{ almacen: string | null }>({ almacen: null });
    readonly alta = form(this.model, (path) => {
      required(path.almacen);
    });
    readonly guardar = (): void => undefined;
  }

  it('lo nombra por su nombre accesible, y el enlace enfoca su control', async () => {
    await TestBed.configureTestingModule({
      imports: [GroupHost],
      providers: [{ provide: EWMS_FORM_MESSAGES, useValue: MESSAGES }],
    }).compileComponents();
    const fixture = TestBed.createComponent(GroupHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const link = root.querySelector<HTMLButtonElement>('[data-form-error]');
    // El grupo de cards no tiene `<label>`: el nombre sale de su `aria-label`.
    expect(link?.textContent?.trim()).toBe('Almacén');

    link?.click();
    expect(document.activeElement).toBe(root.querySelector('[role="radio"][tabindex="0"]'));
    fixture.nativeElement.remove();
  });
});

describe('confirmDiscard', () => {
  it('pregunta solo si el formulario está sucio, y lee el FieldTree', async () => {
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
    const clean = TestBed.runInInjectionContext(() =>
      confirmDiscard({ dirty: () => false }, options),
    );
    expect(clean).toBe(true);
    expect(asked).toBe(0);

    // Un `FieldTree` de verdad. `dirty` es «lo cambió quien lo usa»: escribir el modelo desde el
    // código no ensucia nada, y eso es lo correcto.
    const tree = TestBed.runInInjectionContext(() => form(signal({ codigo: '' })));
    tree.codigo().markAsDirty();
    const answer = TestBed.runInInjectionContext(() => confirmDiscard(tree, options));
    expect(await answer).toBe(false);
    expect(asked).toBe(1);
  });
});
