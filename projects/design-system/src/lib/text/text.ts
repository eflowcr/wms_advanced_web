import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'caption' | 'mono';

/** Cada variante fija tamaño, peso e interlineado y su elemento semántico; sin `as` ni `level`. */
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
