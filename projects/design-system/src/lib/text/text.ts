import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'caption' | 'mono';

/**
 * La única forma canónica de pintar tipografía del sistema. Cada variante fija
 * tamaño, peso e interlineado juntos y pinta el elemento semántico que le
 * corresponde (h1-h4, p, span). Sin escapes por `as` ni por `level`, a propósito.
 */
@Component({
  selector: 'ewms-text',
  templateUrl: './text.html',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class Text {
  readonly variant = input.required<TextVariant>();
}
