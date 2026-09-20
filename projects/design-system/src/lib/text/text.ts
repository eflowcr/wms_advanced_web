import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'caption' | 'mono';

/**
 * The single canonical way to render styled typography in the design system.
 *
 * Each variant sets size, weight, and line-height together.
 * Renders the semantic HTML element for the variant (h1-h4, p, span).
 * No 'as' or 'level' escape hatches by design.
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
