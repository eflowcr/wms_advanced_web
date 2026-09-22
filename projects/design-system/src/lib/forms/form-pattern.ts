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
  signal,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroupDirective } from '@angular/forms';
import { Banner } from '../banner/banner';
import { KeyboardShortcuts } from '../keyboard/keyboard-shortcuts';
import { EWMS_FORM_MESSAGES, NO_FORM_MESSAGES } from './form.types';

/** Un campo con error, tal como lo va a leer quien mira el resumen. */
interface InvalidField {
  readonly label: string;
  readonly element: HTMLElement;
}

/**
 * El resumen que aparece al enviar con errores: un enlace por campo, que enfoca el suyo. Lo crea
 * la directiva; no se escribe en la plantilla. Interno. Ver vault: Patron-Formulario.
 */
@Component({
  selector: 'ewms-form-errors',
  imports: [Banner],
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
            <button
              type="button"
              class="cursor-pointer rounded-sm underline outline-none focus-visible:shadow-(--focus-ring-shadow)"
              [attr.data-form-error]="index"
              (click)="choose.emit(field.element)"
            >
              {{ field.label }}
            </button>
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
  readonly choose = output<HTMLElement>();
}

/**
 * Las reglas del formulario en un solo lugar, sobre `ReactiveForms`: se valida al salir del campo
 * y al enviar, nunca mientras se escribe; **Guardar nunca se deshabilita**, y al enviar con
 * errores se muestra el resumen y se enfoca. Ver vault: Patron-Formulario.
 */
@Directive({
  selector: 'form[ewmsForm]',
  exportAs: 'ewmsForm',
  host: { '(submit)': 'onSubmit($event)' },
})
export class FormPattern {
  /** Se emite solo si el formulario es válido. No `(submit)`: ese es el evento nativo. */
  readonly formSubmit = output<void>();

  /** Sin banner de resumen: para un formulario de dos campos, donde el error ya se ve. */
  readonly summary = input<boolean>(true);

  private readonly host = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly group = inject(FormGroupDirective);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);
  private readonly words = inject(EWMS_FORM_MESSAGES, { optional: true }) ?? NO_FORM_MESSAGES;

  /** El botón de envío se ata a esto: `[loading]="alta.busy()"`. Antidoble envío. */
  private readonly sending = signal(false);
  readonly busy = computed(() => this.sending());

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

  /** Lo llama el consumidor cuando su guardado terminó, salga bien o mal. */
  done(): void {
    this.sending.set(false);
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (this.group.form.invalid) {
      // Tocar todo hace visible cada mensaje: hasta acá solo se veían los campos visitados.
      this.group.form.markAllAsTouched();
      // Tras pintar: los campos marcan `aria-invalid` recién entonces, y de ahí sale el resumen.
      afterNextRender(() => this.showErrors(), { injector: this.injector });
      return;
    }
    this.clearErrors();
    this.sending.set(true);
    this.formSubmit.emit();
  }

  /** Contesta el formulario que tiene el foco; con el foco fuera de todos, el primero (como la Tabla). */
  private ownsShortcut(): boolean {
    const form = this.host.nativeElement;
    const active = form.ownerDocument.activeElement;
    if (active !== null && form.contains(active)) {
      return true;
    }
    const inAnyForm = active?.closest('form[ewmsForm]') ?? null;
    return inAnyForm === null && form.ownerDocument.querySelector('form[ewmsForm]') === form;
  }

  /** Los campos en error, en el orden en que se leen; el nombre sale de su etiqueta. */
  private invalidFields(): readonly InvalidField[] {
    const form = this.host.nativeElement;
    return [...form.querySelectorAll<HTMLElement>('[aria-invalid="true"]')].map((element) => ({
      element,
      label: labelOf(element),
    }));
  }

  private showErrors(): void {
    const fields = this.invalidFields();
    if (!this.summary() || fields.length === 0) {
      return;
    }
    if (this.errors === null) {
      const created = this.viewContainerRef.createComponent(FormErrors);
      created.instance.choose.subscribe((element: HTMLElement) => element.focus());
      // Arriba del formulario: el resumen se lee antes que los campos que resume.
      this.host.nativeElement.insertBefore(created.location.nativeElement, this.host.nativeElement.firstChild);
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
 * La etiqueta del campo: la del `<label>` que lo nombra, o su nombre accesible. Sin el mensaje de
 * error, que en la casilla y el toggle vive dentro del mismo `<label>`, ni el asterisco.
 */
function labelOf(element: HTMLElement): string {
  const label = (element as HTMLInputElement).labels?.[0];
  if (label === undefined) {
    return clean(element.getAttribute('aria-label') ?? '');
  }
  const copy = label.cloneNode(true) as HTMLElement;
  for (const note of copy.querySelectorAll('[id^="ewms-field-error"]')) {
    note.remove();
  }
  return clean(copy.textContent ?? '');
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/\*$/, '').trim();
}
