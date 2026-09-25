import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { submit, type FieldTree } from '@angular/forms/signals';
import { Banner } from '../banner/banner';
import { Button } from '../button/button';
import { KeyboardShortcuts } from '../keyboard/keyboard-shortcuts';
import { EWMS_FORM_MESSAGES, NO_FORM_MESSAGES } from './form.types';

/** Lo que corre al enviar. Devuelve una promesa y el botón queda en carga hasta que resuelva. */
export type FormAction = () => void | Promise<unknown>;

/** Un campo con error, tal como lo va a leer quien mira el resumen. */
interface InvalidField {
  readonly label: string;
  readonly focus: () => void;
}

/**
 * El resumen que aparece al enviar con errores: un enlace por campo, que enfoca el suyo. Lo crea
 * la directiva; no se escribe en la plantilla. Interno. Ver vault: Patron-Formulario.
 */
@Component({
  selector: 'ewms-form-errors',
  imports: [Banner, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block', tabindex: '-1' },
  template: `
    <ewms-banner
      variant="danger"
      [title]="title()"
      [severityLabel]="severityLabel()"
      data-form-errors
    >
      <ul class="flex flex-col gap-1">
        @for (field of fields(); track field.label; let index = $index) {
          <li>
            <ewms-button
              variant="link"
              size="sm"
              [attr.data-form-error]="index"
              (click)="choose.emit(field)"
            >
              {{ field.label }}
            </ewms-button>
          </li>
        }
      </ul>
    </ewms-banner>
  `,
})
export class FormErrors {
  // Con valor por defecto y no `required`: lo crea la directiva, y una entrada obligatoria sin
  // valor al crearlo lanza antes de que nadie pueda llenarla.
  readonly fields = input<readonly InvalidField[]>([]);
  readonly title = input<string>('');
  readonly severityLabel = input<string>('');
  readonly choose = output<InvalidField>();
}

/**
 * Las reglas del formulario en un solo lugar, sobre Signal Forms (ADR 0013): se valida al salir
 * del campo y al enviar, nunca mientras se escribe; **Guardar nunca se deshabilita**, y al enviar
 * con errores se muestra el resumen y se enfoca. Ver vault: Patron-Formulario.
 */
@Directive({
  selector: 'form[ewmsForm]',
  exportAs: 'ewmsForm',
  // `data-ewms-form` porque `[ewmsForm]` es un enlace y no deja atributo: `ownsShortcut` busca
  // los formularios de la página por el DOM.
  host: { '(submit)': 'onSubmit($event)', novalidate: '', 'data-ewms-form': '' },
})
export class FormPattern<T> {
  /** El árbol del formulario: `<form [ewmsForm]="alta">`. */
  readonly form = input.required<FieldTree<T>>({ alias: 'ewmsForm' });

  /**
   * Corre solo si el formulario es válido; `submit()` se encarga de esa mitad. Con el prefijo en
   * el nombre y no por alias: `no-input-rename` solo deja el alias que es el selector.
   */
  readonly ewmsFormAction = input.required<FormAction>();

  /** Sin banner de resumen: para un formulario de dos campos, donde el error ya se ve. */
  readonly summary = input<boolean>(true);

  private readonly host = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly words = inject(EWMS_FORM_MESSAGES, { optional: true }) ?? NO_FORM_MESSAGES;

  /** El botón de envío se ata a esto: `[loading]="alta.busy()"`. Antidoble envío. */
  readonly busy = computed(() => this.form()().submitting());

  /** Un campo por error, sin repetir: `errorSummary()` puede traer dos del mismo campo. */
  private readonly invalidFields = computed<readonly InvalidField[]>(() => {
    const seen = new Set<unknown>();
    const fields: InvalidField[] = [];
    for (const error of this.form()().errorSummary()) {
      // `fieldTree` es el árbol; invocarlo da su estado. Dos errores del mismo campo, un enlace.
      const tree = error.fieldTree;
      if (seen.has(tree)) {
        continue;
      }
      seen.add(tree);
      const element = tree().formFieldBindings()[0]?.element;
      fields.push({
        label: element ? labelOf(element) : '',
        focus: () => tree().focusBoundControl(),
      });
    }
    return fields;
  });

  private errors: { destroy(): void; setInput(name: string, value: unknown): void } | null = null;

  constructor() {
    // `save` del mapa de atajos (Ctrl+S), sin listener nuevo: contesta el formulario con el foco.
    inject(KeyboardShortcuts)
      .events.pipe(takeUntilDestroyed())
      .subscribe(({ action, outcome }) => {
        if (action === 'save' && outcome === 'unregistered' && this.ownsShortcut()) {
          this.host.nativeElement.requestSubmit();
        }
      });
    inject(DestroyRef).onDestroy(() => this.errors?.destroy());
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    // `submit` marca todo como tocado —de ahí salen los mensajes de los campos no visitados— y
    // solo corre la acción si el formulario es válido. `submitting()` da el antidoble envío.
    void submit(this.form(), {
      action: async () => {
        this.clearErrors();
        await this.ewmsFormAction()();
        return undefined;
      },
      // Tras pintar: los mensajes existen recién entonces, y el resumen los nombra.
      onInvalid: () => afterNextRender(() => this.showErrors(), { injector: this.injector }),
    });
  }

  /** Contesta el formulario que tiene el foco; con el foco fuera de todos, el primero (como la Tabla). */
  private ownsShortcut(): boolean {
    const form = this.host.nativeElement;
    const active = form.ownerDocument.activeElement;
    if (active !== null && form.contains(active)) {
      return true;
    }
    const inAnyForm = active?.closest('form[data-ewms-form]') ?? null;
    return (
      inAnyForm === null && form.ownerDocument.querySelector('form[data-ewms-form]') === form
    );
  }

  private showErrors(): void {
    const fields = this.invalidFields();
    if (!this.summary() || fields.length === 0) {
      return;
    }
    if (this.errors === null) {
      const created = this.viewContainerRef.createComponent(FormErrors);
      created.instance.choose.subscribe((field: InvalidField) => field.focus());
      // Arriba del formulario: el resumen se lee antes que los campos que resume.
      this.host.nativeElement.insertBefore(
        created.location.nativeElement,
        this.host.nativeElement.firstChild,
      );
      this.errors = created;
    }
    this.errors.setInput('fields', fields);
    this.errors.setInput('title', this.words.errorSummary(fields.length));
    this.errors.setInput('severityLabel', this.words.errorSummaryLabel);
    (this.host.nativeElement.firstElementChild as HTMLElement | null)?.focus();
  }

  private clearErrors(): void {
    this.errors?.destroy();
    this.errors = null;
  }
}

/**
 * La etiqueta del campo: la del `<label>` o `<legend>` que lo nombra, o su nombre accesible. Sin
 * el mensaje de error, que en la casilla y el toggle vive dentro del mismo `<label>`, ni el asterisco.
 */
function labelOf(element: HTMLElement): string {
  const label = element.querySelector('label, legend');
  if (label === null) {
    // Sin etiqueta propia (el grupo de cards): su nombre accesible.
    return clean(element.querySelector('[aria-label]')?.getAttribute('aria-label') ?? '');
  }
  const copy = label.cloneNode(true) as HTMLElement;
  for (const note of copy.querySelectorAll('[data-field-note]')) {
    note.remove();
  }
  return clean(copy.textContent ?? '');
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/\*$/, '').trim();
}
